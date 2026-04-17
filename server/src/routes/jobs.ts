import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { listMergeFieldsJobs } from "./fieldDefinitions.js";
import { enqueueJob } from "../lib/jobQueue.js";
import {
  FIELD_PROMOTION_APPLY_TYPE,
  FIELD_PROMOTION_PLAN_TYPE,
  getFieldPromotionStateLabel,
  parseFieldPromotionPayload,
  type FieldPromotionState,
} from "../lib/fieldPromotion.js";
import { runFieldPromotionQueueJob } from "../lib/fieldPromotionJobRunner.js";
import {
  applyFieldPromotionCleanup,
  buildFieldPromotionCleanupPreview,
  buildFieldPromotionMismatchRows,
} from "../lib/fieldPromotionCleanup.js";

type UnifiedJobItem = {
  id: string;
  source: "import" | "merge-fields" | "export" | "clean-invalid" | "field-promotion";
  status: "queued" | "processing" | "completed" | "failed";
  state?: FieldPromotionState;
  cleanupDone?: boolean;
  title: string;
  subtitle: string;
  createdAt: string;
  processedRows: number;
  totalRows: number;
  canRetry?: boolean;
  queuePosition?: number;
  estimatedWaitSec?: number;
};

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v || ""));
  return Number.isNaN(+d) ? new Date().toISOString() : d.toISOString();
}

export function registerJobs(app: Express, prisma: PrismaClient) {
  const importJobRepo = (prisma as any).importJob;
  const jobQueueRepo = (prisma as any).jobQueue;
  const fieldDefinitionRepo = (prisma as any).fieldDefinition;
  const useExternalWorker = process.env.JOB_EXECUTION_MODE === "worker";
  const allowedSources = new Set(["all", "import", "merge-fields", "export", "clean-invalid", "field-promotion"]);
  const allowedStatus = new Set(["all", "queued", "processing", "completed", "failed"]);

  async function listUnifiedJobs(
    limit: number,
    sourceFilter: string,
    statusFilter: string
  ): Promise<UnifiedJobItem[]> {
    const [importRows, mergeRows, exportRows, cleanInvalidRows, fieldPromotionRows] = await Promise.all([
      importJobRepo.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      listMergeFieldsJobs(prisma, limit),
      jobQueueRepo.findMany({
        where: { source: "export" },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      jobQueueRepo.findMany({
        where: { source: "clean-invalid" },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      jobQueueRepo.findMany({
        where: { source: "field-promotion" },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ]);

    const queueIds = importRows
      .map((x: any) => String(x.queueJobId || "").trim())
      .filter(Boolean);
    const queueRows = queueIds.length
      ? await jobQueueRepo.findMany({ where: { id: { in: queueIds } } })
      : [];
    const queueById = new Map(queueRows.map((x: any) => [String(x.id), x]));

    const imports: UnifiedJobItem[] = importRows.map((job: any) => ({
      id: String(job.id),
      source: "import",
      status: job.status,
      title: String(job.fileName || `匯入任務 ${String(job.id).slice(0, 8)}`),
      subtitle: `匯入 ${String(job.country || "-")} / ${String(job.provider || "-")}`,
      createdAt: toIso(job.createdAt),
      processedRows: Number(job.processedRows ?? 0),
      totalRows: Number(job.totalRows ?? 0),
      canRetry: Boolean(job.canRetry),
      queuePosition: Number((queueById.get(String(job.queueJobId || "")) as any)?.queuePosition ?? 0),
      estimatedWaitSec: Number((queueById.get(String(job.queueJobId || "")) as any)?.estimatedWaitSec ?? 0),
    }));

    const merges: UnifiedJobItem[] = mergeRows.map((job: any) => ({
      id: job.id,
      source: "merge-fields",
      status: job.status as UnifiedJobItem["status"],
      title: job.targetName ? `合併欄位：${job.targetName}` : `合併欄位 ${job.id.slice(0, 8)}`,
      subtitle: job.message || "欄位合併任務",
      createdAt: toIso(job.createdAt),
      processedRows: Number(job.processedRows ?? 0),
      totalRows: Number(job.totalRows ?? 0),
      canRetry: false,
      queuePosition: Number((job as any).queuePosition ?? 0),
      estimatedWaitSec: Number((job as any).estimatedWaitSec ?? 0),
    }));

    const exports: UnifiedJobItem[] = exportRows.map((job: any) => ({
      id: String(job.id),
      source: "export",
      status: job.status as UnifiedJobItem["status"],
      title: String(job.title || `匯出任務 ${String(job.id).slice(0, 8)}`),
      subtitle: String(job.subtitle || "匯出任務"),
      createdAt: toIso(job.createdAt),
      processedRows: Number(job.progressDone ?? 0),
      totalRows: Number(job.progressTotal ?? 0),
      canRetry: String(job.status) === "failed",
      queuePosition: Number(job.queuePosition ?? 0),
      estimatedWaitSec: Number(job.estimatedWaitSec ?? 0),
    }));
    const cleanInvalids: UnifiedJobItem[] = cleanInvalidRows.map((job: any) => ({
      id: String(job.id),
      source: "clean-invalid",
      status: job.status as UnifiedJobItem["status"],
      title: String(job.title || `清理無效 ${String(job.id).slice(0, 8)}`),
      subtitle: String(job.subtitle || "隔離無效資料"),
      createdAt: toIso(job.createdAt),
      processedRows: Number(job.progressDone ?? 0),
      totalRows: Number(job.progressTotal ?? 0),
      canRetry: false,
      queuePosition: Number(job.queuePosition ?? 0),
      estimatedWaitSec: Number(job.estimatedWaitSec ?? 0),
    }));
    const fieldPromotions: UnifiedJobItem[] = fieldPromotionRows.map((job: any) => {
      const payload = parseFieldPromotionPayload(job.payload);
      const state = payload.state || (String(job.status) === "failed" ? "failed" : "queued");
      const cleanupDone = Boolean((job as any).result?.cleanupApplied);
      return {
        id: String(job.id),
        source: "field-promotion",
        status: job.status as UnifiedJobItem["status"],
        state,
        cleanupDone,
        title: String(job.title || `欄位升級 ${String(job.id).slice(0, 8)}`),
        subtitle: String(job.subtitle || getFieldPromotionStateLabel(state)),
        createdAt: toIso(job.createdAt),
        processedRows: Number(job.progressDone ?? 0),
        totalRows: Number(job.progressTotal ?? 0),
        canRetry: false,
        queuePosition: Number(job.queuePosition ?? 0),
        estimatedWaitSec: Number(job.estimatedWaitSec ?? 0),
      };
    });

    return [...imports, ...merges, ...exports, ...cleanInvalids, ...fieldPromotions]
      .filter((x) => (sourceFilter === "all" ? true : x.source === sourceFilter))
      .filter((x) => (statusFilter === "all" ? true : x.status === statusFilter))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, limit);
  }

  app.get("/api/jobs", async (req, res) => {
    const limitRaw = Number(req.query.limit ?? 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 100;
    const sourceQuery = String(req.query.source || "all");
    const statusQuery = String(req.query.status || "all");
    const sourceFilter = allowedSources.has(sourceQuery) ? sourceQuery : "all";
    const statusFilter = allowedStatus.has(statusQuery) ? statusQuery : "all";
    const items = await listUnifiedJobs(limit, sourceFilter, statusFilter);

    res.json({ items });
  });

  app.get("/api/jobs/stream", async (req, res) => {
    const limitRaw = Number(req.query.limit ?? 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 100;
    const sourceQuery = String(req.query.source || "all");
    const statusQuery = String(req.query.status || "all");
    const sourceFilter = allowedSources.has(sourceQuery) ? sourceQuery : "all";
    const statusFilter = allowedStatus.has(statusQuery) ? statusQuery : "all";
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let closed = false;
    const send = async () => {
      if (closed) return;
      const items = await listUnifiedJobs(limit, sourceFilter, statusFilter);
      res.write(`event: jobs\n`);
      res.write(`data: ${JSON.stringify({ items })}\n\n`);
    };
    await send();
    const timer = setInterval(() => {
      void send();
    }, 1500);
    req.on("close", () => {
      closed = true;
      clearInterval(timer);
      res.end();
    });
  });

  app.get("/api/jobs/:jobId/result", async (req, res) => {
    const row = await jobQueueRepo.findUnique({ where: { id: req.params.jobId } });
    if (!row) return res.status(404).json({ error: "not_found" });
    if (String(row.status) !== "completed") {
      return res.status(409).json({ error: "job_not_completed" });
    }
    return res.json({
      id: String(row.id),
      source: String(row.source),
      status: String(row.status),
      result: (row as any).result || null,
      finishedAt: row.finishedAt ? toIso(row.finishedAt) : null,
    });
  });

  app.get("/api/jobs/:jobId/files/:fileName/download", async (req, res) => {
    const row = await jobQueueRepo.findUnique({ where: { id: req.params.jobId } });
    if (!row) return res.status(404).json({ error: "not_found" });
    if (String(row.source) !== "export") return res.status(400).json({ error: "not_export_job" });
    if (String(row.status) !== "completed") return res.status(409).json({ error: "job_not_completed" });
    const requested = path.basename(String(req.params.fileName || ""));
    const result = ((row as any).result || {}) as {
      files?: Array<{ fileName?: string }>;
      fileName?: string;
    };
    const fileNames = Array.isArray(result.files)
      ? result.files.map((x) => String(x.fileName || "").trim()).filter(Boolean)
      : [String(result.fileName || "").trim()].filter(Boolean);
    if (!fileNames.includes(requested)) {
      return res.status(404).json({ error: "file_not_in_result" });
    }
    const filePath = path.join(process.cwd(), "uploads", "exports", requested);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "file_missing" });
    return res.download(filePath, requested);
  });

  app.post("/api/jobs/:jobId/retry", async (req, res) => {
    const row = await jobQueueRepo.findUnique({ where: { id: req.params.jobId } });
    if (!row) return res.status(404).json({ error: "not_found" });
    if (String(row.source) !== "export") return res.status(400).json({ error: "not_export_job" });
    if (String(row.status) !== "failed") return res.status(400).json({ error: "retry_not_allowed" });
    const payload = ((row as any).payload || {}) as Record<string, unknown>;
    const retryNo = Number((row as any).attempt ?? 0) + 1;
    const { item: queuedJob } = await enqueueJob(prisma, {
      source: "export",
      type: "export-retry",
      title: String(row.title || "匯出重試"),
      subtitle: `重試 #${retryNo}`,
      payload,
      maxAttempts: Number((row as any).maxAttempts ?? 3),
    });
    return res.json({
      retried: true,
      jobId: String((queuedJob as any).id),
      queuePosition: Number((queuedJob as any).queuePosition ?? 0),
      estimatedWaitSec: Number((queuedJob as any).estimatedWaitSec ?? 0),
    });
  });

  app.get("/api/jobs/field-promotion/:jobId", async (req, res) => {
    const row = await jobQueueRepo.findUnique({ where: { id: req.params.jobId } });
    if (!row) return res.status(404).json({ error: "not_found" });
    if (String(row.source) !== "field-promotion") return res.status(400).json({ error: "not_field_promotion_job" });
    const payload = parseFieldPromotionPayload((row as any).payload);
    const state = payload.state || (String(row.status) === "failed" ? "failed" : "queued");
    return res.json({
      id: String(row.id),
      status: String(row.status),
      state,
      title: String(row.title || ""),
      subtitle: String(row.subtitle || getFieldPromotionStateLabel(state)),
      createdAt: toIso(row.createdAt),
      importJobId: payload.importJobId ? String(payload.importJobId) : undefined,
      fields: payload.fields || [],
      rules: payload.rules || null,
      plan: payload.plan || null,
      scheduledForRestartAt: payload.scheduledForRestartAt || null,
      lastError: payload.lastError || null,
      technicalError: String(row.error || ""),
      finishedAt: row.finishedAt ? toIso(row.finishedAt) : null,
      result: (row as any).result || null,
      cleanup: payload.cleanup || null,
    });
  });

  app.post("/api/jobs/field-promotion/:jobId", async (req, res) => {
    const row = await jobQueueRepo.findUnique({ where: { id: req.params.jobId } });
    if (!row) return res.status(404).json({ error: "not_found" });
    if (String(row.source) !== "field-promotion") return res.status(400).json({ error: "not_field_promotion_job" });
    const body = (req.body || {}) as {
      type?: string;
      allowNull?: boolean;
      enableFilter?: boolean;
      enableSort?: boolean;
      writeAliases?: boolean;
      purgeAttrsAfterPromotion?: boolean;
      note?: string;
    };
    const type = String(body.type || "").trim();
    if (!type) return res.status(400).json({ error: "type_required" });
    const payload = parseFieldPromotionPayload((row as any).payload);
    payload.rules = {
      type: type as NonNullable<typeof payload.rules>["type"],
      allowNull: Boolean(body.allowNull),
      enableFilter: Boolean(body.enableFilter),
      enableSort: Boolean(body.enableSort),
      writeAliases: Boolean(body.writeAliases),
      purgeAttrsAfterPromotion: body.purgeAttrsAfterPromotion !== false,
      note: String(body.note || "").trim(),
    };
    payload.state = "rules-confirmed";
    const fieldKeys = (payload.fields || []).map((field) => field.key).filter(Boolean);
    const now = new Date();
    if (fieldKeys.length > 0) {
      await fieldDefinitionRepo.updateMany({
        where: { key: { in: fieldKeys } },
        data: {
          promotionStatus: "rules-confirmed",
          promotionJobId: String(row.id),
          promotionRules: payload.rules as any,
          promotionUpdatedAt: now,
        },
      });
    }
    await jobQueueRepo.update({
      where: { id: String(row.id) },
      data: {
        payload: payload as any,
        type: FIELD_PROMOTION_PLAN_TYPE,
        status: "queued",
        subtitle: getFieldPromotionStateLabel("rules-confirmed"),
        message: "field_promotion_rules_confirmed",
        progressDone: 0,
        progressTotal: 1,
        error: null,
        finishedAt: null,
        startedAt: null,
        result: null,
      },
    });
    if (!useExternalWorker) {
      setImmediate(() => {
        void runFieldPromotionQueueJob(prisma, String(row.id));
      });
    }
    return res.json({
      saved: true,
      jobId: String(row.id),
      state: "rules-confirmed",
    });
  });

  app.post("/api/jobs/field-promotion/:jobId/schedule-restart", async (req, res) => {
    const row = await jobQueueRepo.findUnique({ where: { id: req.params.jobId } });
    if (!row) return res.status(404).json({ error: "not_found" });
    if (String(row.source) !== "field-promotion") return res.status(400).json({ error: "not_field_promotion_job" });
    const payload = parseFieldPromotionPayload((row as any).payload);
    if (payload.state !== "pending-maintenance" && payload.state !== "failed") {
      return res.status(400).json({ error: "field_promotion_not_schedulable" });
    }
    const now = new Date();
    payload.state = "scheduled-on-restart";
    payload.scheduledForRestartAt = now.toISOString();
    payload.lastError = undefined;
    const fieldKeys = (payload.fields || []).map((field) => field.key).filter(Boolean);
    if (fieldKeys.length > 0) {
      await fieldDefinitionRepo.updateMany({
        where: { key: { in: fieldKeys } },
        data: {
          promotionStatus: "scheduled-on-restart",
          promotionJobId: String(row.id),
          promotionUpdatedAt: now,
        },
      });
    }
    await jobQueueRepo.update({
      where: { id: String(row.id) },
      data: {
        payload: payload as any,
        type: FIELD_PROMOTION_APPLY_TYPE,
        status: "completed",
        subtitle: getFieldPromotionStateLabel("scheduled-on-restart"),
        message: "field_promotion_scheduled_on_restart",
        progressDone: 0,
        progressTotal: 1,
        error: null,
        startedAt: null,
        finishedAt: now,
        result: {
          state: "scheduled-on-restart",
          scheduledForRestartAt: payload.scheduledForRestartAt,
        },
      },
    });
    return res.json({
      scheduled: true,
      jobId: String(row.id),
      state: "scheduled-on-restart",
    });
  });

  app.post("/api/jobs/field-promotion/:jobId/cleanup-preview", async (req, res) => {
    const row = await jobQueueRepo.findUnique({ where: { id: req.params.jobId } });
    if (!row) return res.status(404).json({ error: "not_found" });
    if (String(row.source) !== "field-promotion") return res.status(400).json({ error: "not_field_promotion_job" });
    const payload = parseFieldPromotionPayload((row as any).payload);
    if (payload.state !== "applied") return res.status(400).json({ error: "field_promotion_not_applied" });
    const preview = await buildFieldPromotionCleanupPreview(prisma, (row as any).payload);
    payload.cleanup = { ...(payload.cleanup || {}), lastPreview: preview };
    await jobQueueRepo.update({
      where: { id: String(row.id) },
      data: {
        payload: payload as any,
        result: {
          ...(((row as any).result || {}) as Record<string, unknown>),
          cleanupPreview: preview,
        },
      },
    });
    return res.json({ preview });
  });

  app.post("/api/jobs/field-promotion/:jobId/cleanup-apply", async (req, res) => {
    const row = await jobQueueRepo.findUnique({ where: { id: req.params.jobId } });
    if (!row) return res.status(404).json({ error: "not_found" });
    if (String(row.source) !== "field-promotion") return res.status(400).json({ error: "not_field_promotion_job" });
    const payload = parseFieldPromotionPayload((row as any).payload);
    if (payload.state !== "applied") return res.status(400).json({ error: "field_promotion_not_applied" });
    const body = (req.body || {}) as { confirmed?: boolean };
    if (!body.confirmed) return res.status(400).json({ error: "cleanup_confirm_required" });
    const applied = await applyFieldPromotionCleanup(prisma, String(row.id), (row as any).payload);
    payload.cleanup = { ...(payload.cleanup || {}), lastApplied: applied };
    await jobQueueRepo.update({
      where: { id: String(row.id) },
      data: {
        payload: payload as any,
        result: {
          ...(((row as any).result || {}) as Record<string, unknown>),
          cleanupApplied: applied,
        },
      },
    });
    return res.json({ applied });
  });

  app.get("/api/jobs/field-promotion/:jobId/cleanup-mismatch-report", async (req, res) => {
    const row = await jobQueueRepo.findUnique({ where: { id: req.params.jobId } });
    if (!row) return res.status(404).json({ error: "not_found" });
    if (String(row.source) !== "field-promotion") return res.status(400).json({ error: "not_field_promotion_job" });
    const payload = parseFieldPromotionPayload((row as any).payload);
    if (payload.state !== "applied") return res.status(400).json({ error: "field_promotion_not_applied" });
    const rows = await buildFieldPromotionMismatchRows(prisma, (row as any).payload);
    const header = ["fieldKey", "column", "cuid", "attrValue", "promotedValue"];
    const body = rows.map((item) =>
      [
        item.key,
        item.column,
        item.cuid,
        String(item.attrValue || "").replace(/"/g, '""'),
        String(item.promotedValue || "").replace(/"/g, '""'),
      ]
        .map((x) => `"${x}"`)
        .join(",")
    );
    const csv = [header.join(","), ...body].join("\n");
    const fileName = `field-promotion-mismatch-${String(row.id).slice(0, 8)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.status(200).send(csv);
  });
}
