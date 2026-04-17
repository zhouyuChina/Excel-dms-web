import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import {
  analyzeImportColumns,
  buildHeaderKeyMap,
  buildImportSampleRows,
  parseImportBuffer,
  type ImportColumnMappingEntry,
} from "../lib/importSpreadsheet.js";
import { toolError } from "../lib/toolError.js";
import { enqueueJob } from "../lib/jobQueue.js";
import { runImportJob } from "../lib/importJobRunner.js";
import {
  applyPromotedFpValuesForCuids,
  loadPromotedWritableColumns,
  stripPromotedKeysToFpValues,
  syncPromotedColumnsForCuids,
} from "../lib/promotedSync.js";

const uploadDir = path.join(process.cwd(), "uploads", "imports");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 160 * 1024 * 1024 },
});
const importErrorDir = path.join(process.cwd(), "uploads", "import-errors");
fs.mkdirSync(importErrorDir, { recursive: true });

function truncateRows(nums: number[], max = 100): number[] {
  return nums.slice(0, max);
}

function maybeRepairMojibake(input: string): string {
  const s = String(input || "");
  // Common mojibake markers when UTF-8 bytes were decoded as latin1/cp1252.
  const looksBroken =
    /Ã|Â|Ð|Ñ|�/.test(s) ||
    /[À-ÿ]{2,}/.test(s);
  if (!looksBroken) return s;
  try {
    const repaired = Buffer.from(s, "latin1").toString("utf8");
    return repaired || s;
  } catch {
    return s;
  }
}

function decodeUploadFileName(input: string): string {
  const raw = String(input || "");
  try {
    // Multer/busboy on Windows often decodes utf8 filename as latin1.
    return Buffer.from(raw, "latin1").toString("utf8");
  } catch {
    return raw;
  }
}

export function registerImports(app: Express, prisma: PrismaClient) {
  const importJobRepo = (prisma as any).importJob;
  const useExternalWorker = process.env.JOB_EXECUTION_MODE === "worker";

  async function runChunkedImport(jobId: string, queueJobId?: string | null) {
    return runImportJob(prisma, jobId, queueJobId);
  }

  app.post(
    "/api/imports/analyze",
    upload.single("file"),
    async (req, res) => {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "file_required" });
      }
      const decodedFileName = decodeUploadFileName(file.originalname);
      try {
        const buffer = fs.readFileSync(file.path);
        const parsed = parseImportBuffer(buffer, decodedFileName);
        if (parsed.fatal) {
          return res.status(400).json({ error: "parse_failed", message: parsed.fatal });
        }
        const sheetRows = parsed.sheetRows;
        const headers = Object.keys(sheetRows[0] || {});
        const existingFields = await prisma.fieldDefinition.findMany({
          select: { key: true, name: true, aliases: true, type: true },
        });
        const columns = analyzeImportColumns(headers, existingFields);
        const samples = buildImportSampleRows(sheetRows, headers, 3);
        const mergeTargets = existingFields
          .map((f) => ({ key: f.key, name: f.name }))
          .sort((a, b) => a.key.localeCompare(b.key));
        return res.json({
          fileName: maybeRepairMojibake(decodedFileName),
          headers,
          columns,
          samples,
          mergeTargets,
        });
      } finally {
        try {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        } catch {
          /* ignore */
        }
      }
    }
  );

  app.get("/api/imports", async (_req, res) => {
    const rows = await importJobRepo.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({
      items: rows.map((job: any) => ({
        id: job.id,
        status: job.status,
        fileName: maybeRepairMojibake(job.fileName),
        country: maybeRepairMojibake(job.country),
        provider: maybeRepairMojibake(job.provider),
        totalRows: job.totalRows,
        processedRows: job.processedRows,
        successRows: job.successRows,
        failedRows: job.failedRows,
        checkpointChunk: job.checkpointChunk,
        chunkSize: job.chunkSize,
        canRetry: job.canRetry,
        errorPrimary: job.errorPrimary,
        errorCount: job.errorCount,
        errorRowNumbers: job.errorRowNumbers,
        errorReportPath: job.errorReportPath,
        createdAt: job.createdAt,
        finishedAt: job.finishedAt,
      })),
    });
  });
  app.get("/api/imports/:jobId", async (req, res) => {
    const job = await importJobRepo.findUnique({
      where: { id: req.params.jobId },
    });
    if (!job) return res.status(404).json({ error: "not_found" });
    res.json({
      id: job.id,
      status: job.status,
      fileName: maybeRepairMojibake(job.fileName),
      country: maybeRepairMojibake(job.country),
      provider: maybeRepairMojibake(job.provider),
      totalRows: job.totalRows,
      processedRows: job.processedRows,
      successRows: job.successRows,
      failedRows: job.failedRows,
      checkpointChunk: job.checkpointChunk,
      chunkSize: job.chunkSize,
      canRetry: job.canRetry,
      insertedCount: job.insertedCount,
      errorPrimary: job.errorPrimary,
      errorRowNumbers: job.errorRowNumbers,
      errorCount: job.errorCount,
      errorReportPath: job.errorReportPath,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
    });
  });

  app.post(
    "/api/imports",
    upload.single("file"),
    async (req, res) => {
      const file = req.file;
      const country = maybeRepairMojibake(String(req.body?.country || "").trim());
      const provider = maybeRepairMojibake(String(req.body?.provider || "").trim());
      if (!file) {
        return res.status(400).json({ error: "file_required" });
      }
      const decodedFileName = decodeUploadFileName(file.originalname);
      if (!country || !provider) {
        fs.unlink(file.path, () => {});
        return res.status(400).json({ error: "country_provider_required" });
      }

      let columnMapping: Record<string, ImportColumnMappingEntry> | undefined;
      const rawCm = req.body?.columnMapping;
      if (typeof rawCm === "string" && rawCm.trim()) {
        try {
          columnMapping = JSON.parse(rawCm) as Record<string, ImportColumnMappingEntry>;
        } catch {
          fs.unlink(file.path, () => {});
          return res.status(400).json({ error: "invalid_column_mapping" });
        }
      }
      if (!columnMapping || Object.keys(columnMapping).length === 0) {
        fs.unlink(file.path, () => {});
        return res.status(400).json({
          error: "column_mapping_required",
          message: "請先解析欄位並確認對照後再匯入",
        });
      }

      const buffer = fs.readFileSync(file.path);
      const parsed = parseImportBuffer(buffer, decodedFileName);
      if (parsed.fatal) {
        fs.unlink(file.path, () => {});
        return res.status(400).json({ error: "parse_failed", message: parsed.fatal });
      }
      const headers = Object.keys(parsed.sheetRows[0] || {});
      const existingFields = await prisma.fieldDefinition.findMany({
        select: { key: true, name: true, aliases: true, type: true },
      });
      let headerToKey: Map<string, string>;
      try {
        const built = buildHeaderKeyMap(headers, existingFields, columnMapping ?? null);
        headerToKey = built.headerToKey;
        const hasPhone = [...headerToKey.values()].includes("phone");
        if (!hasPhone) {
          fs.unlink(file.path, () => {});
          return res.status(400).json({
            error: "phone_column_required",
            message: "必須至少保留一欄對應到電話（phone）",
          });
        }
      } catch (e) {
        fs.unlink(file.path, () => {});
        const msg = e instanceof Error ? e.message : String(e);
        return res.status(400).json({ error: "invalid_column_mapping", message: msg });
      }

      const job = await importJobRepo.create({
        data: {
          status: "queued",
          fileName: maybeRepairMojibake(decodedFileName),
          filePath: file.path,
          country,
          provider,
          columnMapping: columnMapping as object,
          chunkSize: 5000,
          mode: "async_chunked",
        },
      });
      const { item: queuedJob, deduped } = await enqueueJob(prisma, {
        source: "import",
        type: "import-file",
        title: maybeRepairMojibake(decodedFileName),
        subtitle: `匯入 ${country} / ${provider}`,
        payload: {
          importJobId: job.id,
          country,
          provider,
          fileName: maybeRepairMojibake(decodedFileName),
        },
      });
      await importJobRepo.update({
        where: { id: job.id },
        data: { queueJobId: String(queuedJob.id) },
      });
      if (!useExternalWorker) {
        setImmediate(() => {
          void runChunkedImport(job.id, String(queuedJob.id));
        });
      }
      res.status(202).json({
        jobId: job.id,
        status: "queued",
        deduped,
        queuePosition: Number((queuedJob as any).queuePosition ?? 0),
        estimatedWaitSec: Number((queuedJob as any).estimatedWaitSec ?? 0),
      });
    }
  );

  app.post("/api/imports/:jobId/retry", async (req, res) => {
    const job = await importJobRepo.findUnique({ where: { id: req.params.jobId } });
    if (!job) return res.status(404).json({ error: "not_found" });
    if (!job.canRetry || !job.filePath || job.status !== "failed") {
      return res.status(400).json({ error: "retry_not_allowed" });
    }
    const locked = await importJobRepo.updateMany({
      where: { id: job.id, status: "failed", canRetry: true },
      data: {
        status: "queued",
        canRetry: false,
        processedRows: 0,
        successRows: 0,
        failedRows: 0,
        checkpointChunk: 0,
        errorPrimary: null,
        errorCount: 0,
        errorRowNumbers: [],
        finishedAt: null,
      },
    });
    if (!locked?.count) return res.status(409).json({ error: "job_busy" });
    const { item: queuedJob } = await enqueueJob(prisma, {
      source: "import",
      type: "import-retry",
      title: maybeRepairMojibake(job.fileName),
      subtitle: `重試匯入 ${maybeRepairMojibake(job.country)} / ${maybeRepairMojibake(job.provider)}`,
      payload: { importJobId: job.id, retry: true },
    });
    await importJobRepo.update({
      where: { id: job.id },
      data: { queueJobId: String(queuedJob.id) },
    });
    if (!useExternalWorker) {
      setImmediate(() => {
        void runChunkedImport(job.id, String(queuedJob.id));
      });
    }
    res.json({
      retried: true,
      jobId: job.id,
      queuePosition: Number((queuedJob as any).queuePosition ?? 0),
      estimatedWaitSec: Number((queuedJob as any).estimatedWaitSec ?? 0),
    });
  });

  app.delete("/api/imports/:jobId", async (req, res) => {
    const job = await importJobRepo.findUnique({ where: { id: req.params.jobId } });
    if (!job) return res.status(404).json({ error: "not_found" });
    if (job.status === "processing") {
      return res.status(409).json({ error: "job_processing_cannot_delete" });
    }
    let deletedRows = 0;
    let skippedEditedRows = 0;
    if (job.status === "completed") {
      const tag = `import:${job.id}:`;
      const rows = await prisma.customer.findMany({
        where: {
          country: job.country,
          provider: job.provider,
          importRecord: { contains: tag },
        },
        select: { cuid: true, createdAt: true, updatedAt: true },
      });
      const deletableCuids = rows
        .filter((x) => x.updatedAt.getTime() === x.createdAt.getTime())
        .map((x) => x.cuid);
      skippedEditedRows = rows.length - deletableCuids.length;
      if (deletableCuids.length > 0) {
        const removed = await prisma.customer.deleteMany({
          where: { cuid: { in: deletableCuids } },
        });
        deletedRows = Number(removed.count || 0);
      }
    }
    if (job.filePath) {
      try {
        if (fs.existsSync(job.filePath)) fs.unlinkSync(job.filePath);
      } catch {
        // ignore file deletion failure and continue removing record
      }
    }
    if (job.errorReportPath) {
      try {
        if (fs.existsSync(job.errorReportPath)) fs.unlinkSync(job.errorReportPath);
      } catch {
        // ignore file deletion failure and continue removing record
      }
    }
    const queueJobId = String((job as any).queueJobId || "").trim();
    if (queueJobId) {
      await (prisma as any).jobQueue.deleteMany({ where: { id: queueJobId } });
    }
    await importJobRepo.delete({ where: { id: job.id } });
    return res.json({
      deleted: true,
      deletedRows,
      skippedEditedRows,
    });
  });

  app.post(
    "/api/jobs/update-by-file",
    upload.single("file"),
    async (req, res) => {
      const file = req.file;
      if (!file) {
        return res.status(400).json(toolError("file_required", "請先選擇更新檔案"));
      }

      const buffer = fs.readFileSync(file.path);
      fs.unlink(file.path, () => {});

      const parsed = parseImportBuffer(buffer, file.originalname);
      if (parsed.fatal) {
        return res.status(400).json(toolError("invalid_file", parsed.fatal));
      }

      const sheetRows = parsed.sheetRows;
      const existingFields = await prisma.fieldDefinition.findMany({
        select: { key: true, name: true, aliases: true, type: true },
      });
      const headers = Object.keys(sheetRows[0] || {});
      const { headerToKey, newFields } = buildHeaderKeyMap(headers, existingFields);
      const blockedHeaders = [...headerToKey.entries()]
        .filter(([, key]) => key === "phone" || key === "country")
        .map(([header]) => header);
      if (blockedHeaders.length > 0) {
        return res.status(400).json({
          ...toolError(
            "phone_country_update_not_allowed",
            `更新資料檔不可包含 phone/country 欄位（偵測到：${blockedHeaders.join(", ")}）`,
            { blockedHeaders }
          ),
        });
      }

      const cuidHeader = [...headerToKey.entries()].find(([, key]) => key === "cuid")?.[0];
      if (!cuidHeader) {
        return res
          .status(400)
          .json(toolError("cuid_required", "缺少 CUID 欄位（需包含 cuid/id）"));
      }

      const rowErrors: Array<{ rowNum: number; reason: string }> = [];
      const seen = new Set<string>();
      const patches: Array<{ rowNum: number; cuid: string; fixed: Record<string, unknown>; attrs: Record<string, unknown> }> = [];
      const coreKeys = new Set([
        "country",
        "provider",
        "phone",
        "name",
        "englishName",
        "age",
        "birthDate",
        "position",
        "salary",
        "email",
        "department",
        "importRecord",
        "exportRecord",
        "recipient",
        "isError",
      ]);

      for (let i = 0; i < sheetRows.length; i++) {
        const raw = sheetRows[i]!;
        const rowNum = i + 2;
        const cuid = String(raw[cuidHeader] ?? "").trim();
        if (!cuid) {
          rowErrors.push({ rowNum, reason: "缺少 CUID" });
          continue;
        }
        if (seen.has(cuid)) {
          rowErrors.push({ rowNum, reason: "檔案內 CUID 重複" });
          continue;
        }
        seen.add(cuid);

        const fixed: Record<string, unknown> = {};
        const attrs: Record<string, unknown> = {};
        for (const [header, key] of headerToKey.entries()) {
          if (key === "cuid") continue;
          const rawValue = raw[header];
          const text = String(rawValue ?? "").trim();
          // 空白不覆蓋（使用者要求）
          if (!text) continue;
          if (coreKeys.has(key)) {
            if (key === "age" || key === "salary") {
              const n = Number(text);
              if (!Number.isFinite(n)) continue;
              fixed[key] = n;
            } else if (key === "isError") {
              fixed[key] = ["true", "1", "yes", "y"].includes(text.toLowerCase());
            } else {
              fixed[key] = text;
            }
          } else {
            attrs[key] = text;
          }
        }
        if (Object.keys(fixed).length === 0 && Object.keys(attrs).length === 0) {
          rowErrors.push({ rowNum, reason: "無可更新欄位（空白不覆蓋）" });
          continue;
        }
        patches.push({ rowNum, cuid, fixed, attrs });
      }

      if (rowErrors.length) {
        const nums = rowErrors.map((e) => e.rowNum).sort((a, b) => a - b);
        return res.status(400).json({
          status: "failed",
          primaryReason:
            rowErrors.length === 1
              ? `第 ${nums[0]} 列：${rowErrors[0]!.reason}`
              : `共 ${rowErrors.length} 列未通過驗證（例：第 ${nums[0]} 列）`,
          errorRowNumbers: truncateRows(nums),
          errorCount: rowErrors.length,
        });
      }

      const missing: Array<{ rowNum: number; reason: string }> = [];
      for (const p of patches) {
        const exists = await prisma.customer.findUnique({ where: { cuid: p.cuid }, select: { cuid: true } });
        if (!exists) missing.push({ rowNum: p.rowNum, reason: "CUID 不存在" });
      }
      if (missing.length) {
        const nums = missing.map((e) => e.rowNum).sort((a, b) => a - b);
        return res.status(400).json({
          status: "failed",
          primaryReason:
            missing.length === 1
              ? `第 ${nums[0]} 列：${missing[0]!.reason}`
              : `共 ${missing.length} 列 CUID 不存在（例：第 ${nums[0]} 列）`,
          errorRowNumbers: truncateRows(nums),
          errorCount: missing.length,
        });
      }

      const promotedWritableUpdate = await loadPromotedWritableColumns(prisma);
      const fpAfterTx: Array<{ cuid: string; fpValues: Record<string, string> }> = [];

      await prisma.$transaction(async (tx: any) => {
        for (const nf of newFields) {
          await tx.fieldDefinition.upsert({
            where: { key: nf.key },
            create: {
              key: nf.key,
              name: nf.name,
              uiColor: "bg-gray-500",
              type: nf.type,
              category: "",
              aliases: nf.aliases,
              source: "import",
              isRequired: false,
              isSystem: false,
              defaultVisible: true,
              isExportable: true,
              sortOrder: 9999,
              groupId: null,
            },
            update: {},
          });
        }

        for (const p of patches) {
          const current = await tx.customer.findUnique({
            where: { cuid: p.cuid },
            select: { attrs: true },
          });
          const mergedAttrs =
            current?.attrs && typeof current.attrs === "object" && !Array.isArray(current.attrs)
              ? { ...(current.attrs as Record<string, unknown>), ...p.attrs }
              : { ...p.attrs };
          const data: Record<string, unknown> = { ...(p.fixed as Record<string, unknown>) };
          if (Object.keys(p.attrs).length) {
            const { attrs: attrsForDb, fpValues } = stripPromotedKeysToFpValues(
              mergedAttrs,
              promotedWritableUpdate
            );
            data.attrs = attrsForDb;
            if (Object.keys(fpValues).length > 0) fpAfterTx.push({ cuid: p.cuid, fpValues });
          }
          await tx.customer.update({
            where: { cuid: p.cuid },
            data: data as any,
          });
        }
      });
      if (fpAfterTx.length) await applyPromotedFpValuesForCuids(prisma, fpAfterTx);
      await syncPromotedColumnsForCuids(
        prisma,
        patches.map((p) => p.cuid)
      );

      res.json({ status: "completed", updatedCount: patches.length });
    }
  );
}
