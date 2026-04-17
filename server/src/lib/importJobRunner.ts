import fs from "node:fs";
import path from "node:path";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  buildHeaderKeyMap,
  parseImportBuffer,
  sheetRowsToCustomerPayloads,
  type ImportColumnMappingEntry,
  type NewFieldSeed,
} from "./importSpreadsheet.js";
import {
  buildCountryPhoneKeySet,
  businessUniqueKey,
  collectDuplicateRowsByBusinessKey,
} from "./businessUnique.js";
import { updateJobProgress } from "./jobQueue.js";
import { toPromotedColumnName } from "./fieldPromotionSql.js";
import { FIELD_PROMOTION_REVIEW_TYPE } from "./fieldPromotion.js";
import { applyPromotedFpValuesForCuids } from "./promotedSync.js";

const importErrorDir = path.join(process.cwd(), "uploads", "import-errors");
fs.mkdirSync(importErrorDir, { recursive: true });

function truncateRows(nums: number[], max = 100): number[] {
  return nums.slice(0, max);
}

export async function runImportJob(
  prisma: PrismaClient,
  importJobId: string,
  queueJobId?: string | null
) {
  const importJobRepo = (prisma as any).importJob;
  const job = await importJobRepo.findUnique({ where: { id: importJobId } });
  if (!job || !job.filePath) return;

  // 互斥鎖：同一 importJob 只允許一個執行器啟動（避免狀態 failed/completed 抖動）
  const lock = await importJobRepo.updateMany({
    where: { id: importJobId, status: "queued" },
    data: {
      status: "processing",
      totalRows: 0,
      canRetry: false,
      processedRows: 0,
      successRows: 0,
      failedRows: 0,
      checkpointChunk: 0,
    },
  });
  if (!lock.count) {
    // 代表已被其他執行器接手或已不在可執行狀態
    return;
  }

  const chunkSize = Math.max(1000, Number(job.chunkSize || 5000));
  const buffer = fs.readFileSync(job.filePath);
  const parsed = parseImportBuffer(buffer, job.fileName);
  if (parsed.fatal) {
    await importJobRepo.update({
      where: { id: importJobId },
      data: {
        status: "failed",
        canRetry: false,
        errorPrimary: parsed.fatal,
        errorCount: 1,
        errorRowNumbers: [],
        finishedAt: new Date(),
      },
    });
    if (queueJobId) {
      await updateJobProgress(prisma, queueJobId, {
        status: "failed",
        message: "匯入失敗",
        error: parsed.fatal,
        finishedAt: new Date(),
      });
    }
    return;
  }

  const sheetRows = parsed.sheetRows;
  const existingFields = await prisma.fieldDefinition.findMany({
    select: { key: true, name: true, aliases: true, type: true },
  });
  const headers = Object.keys(sheetRows[0] || {});
  const rawMapping = (job as { columnMapping?: unknown }).columnMapping;
  let userMapping: Record<string, ImportColumnMappingEntry> | null = null;
  if (rawMapping && typeof rawMapping === "object" && !Array.isArray(rawMapping)) {
    userMapping = rawMapping as Record<string, ImportColumnMappingEntry>;
  }
  let headerToKey: Map<string, string>;
  let newFields: NewFieldSeed[];
  try {
    const built = buildHeaderKeyMap(headers, existingFields, userMapping);
    headerToKey = built.headerToKey;
    newFields = built.newFields;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await importJobRepo.update({
      where: { id: importJobId },
      data: {
        status: "failed",
        canRetry: false,
        errorPrimary: `欄位對照無效：${msg}`,
        errorCount: 1,
        errorRowNumbers: [],
        finishedAt: new Date(),
      },
    });
    if (queueJobId) {
      await updateJobProgress(prisma, queueJobId, {
        status: "failed",
        message: "匯入失敗",
        error: msg,
        finishedAt: new Date(),
      });
    }
    return;
  }
  const { payloads, rowErrors } = sheetRowsToCustomerPayloads(
    sheetRows,
    headerToKey,
    job.country,
    job.provider,
    `import:${job.id}:${new Date().toISOString().slice(0, 10)}`,
    { allowFilePhoneDuplicates: true }
  );
  if (rowErrors.length) {
    const nums = rowErrors.map((e) => e.rowNum).sort((a, b) => a - b);
    const errorReportPath = path.join(importErrorDir, `${importJobId}.json`);
    fs.writeFileSync(errorReportPath, JSON.stringify(rowErrors, null, 2), "utf8");
    await importJobRepo.update({
      where: { id: importJobId },
      data: {
        status: "failed",
        canRetry: false,
        errorPrimary: `共 ${rowErrors.length} 列未通過驗證（例：第 ${nums[0]} 列）`,
        errorCount: rowErrors.length,
        errorRowNumbers: truncateRows(nums),
        failedRows: rowErrors.length,
        errorReportPath,
        finishedAt: new Date(),
      },
    });
    if (queueJobId) {
      await updateJobProgress(prisma, queueJobId, {
        status: "failed",
        progressTotal: payloads.length,
        progressDone: 0,
        message: "匯入失敗",
        error: `共 ${rowErrors.length} 列未通過驗證`,
        finishedAt: new Date(),
      });
    }
    return;
  }

  const duplicateRows = collectDuplicateRowsByBusinessKey(
    payloads.map(({ rowNum, data }) => {
      const d = data as { country: string; phoneNormalized: string };
      return { rowNum, country: d.country, phoneNormalized: d.phoneNormalized };
    })
  );
  const duplicateRowSet = new Set<number>(duplicateRows);
  await importJobRepo.update({
    where: { id: importJobId },
    data: {
      totalRows: payloads.length,
      canRetry: false,
      processedRows: 0,
      successRows: 0,
      failedRows: 0,
      checkpointChunk: 0,
    },
  });
  if (queueJobId) {
    await updateJobProgress(prisma, queueJobId, {
      status: "processing",
      progressTotal: payloads.length,
      progressDone: 0,
      queuePosition: 0,
      estimatedWaitSec: 0,
      message: "開始匯入",
    });
  }
  try {
    const promotedDefs = await prisma.fieldDefinition.findMany({
      where: { storageMode: "promoted", promotionStatus: "applied" },
      select: { key: true },
    });
    const customerColumns = (await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Customer'`
    )) as Array<{ column_name?: string }>;
    const customerColumnSet = new Set(
      customerColumns.map((x) => String(x.column_name || "").trim()).filter(Boolean)
    );
    const promotedWritable = promotedDefs
      .map((x) => {
        const key = String(x.key || "").trim();
        if (!key) return null;
        const column = toPromotedColumnName(key);
        if (!customerColumnSet.has(column)) return null;
        return { key, column };
      })
      .filter((x): x is { key: string; column: string } => Boolean(x));
    for (const nf of newFields) {
      await prisma.fieldDefinition.upsert({
        where: { key: nf.key },
        create: {
          key: nf.key,
          name: nf.name,
          uiColor: "bg-gray-500",
          type: nf.type,
          category: "",
          aliases: nf.aliases,
          source: nf.source,
          isRequired: false,
          isSystem: false,
          defaultVisible: nf.defaultVisible,
          isExportable: nf.isExportable,
          sortOrder: 9999,
          groupId: null,
          storageMode: "dynamic",
          promotionStatus: "queued",
          promotionSourceHeader: nf.aliases[0] || nf.name,
          promotionJobId: null,
          promotionRules: Prisma.JsonNull,
          promotionPlan: Prisma.JsonNull,
          promotionUpdatedAt: new Date(),
        },
        update: {
          name: nf.name,
          type: nf.type,
          aliases: nf.aliases,
          source: nf.source,
          defaultVisible: nf.defaultVisible,
          isExportable: nf.isExportable,
        },
      });
    }
    const allConflicts = await buildCountryPhoneKeySet(prisma, job.country);
    let successRows = 0;
    const failedItems: Array<{ rowNum: number; reason: string }> = duplicateRows.map((rowNum) => ({
      rowNum,
      reason: "檔案內電話重複",
    }));
    for (let idx = 0; idx < payloads.length; idx += chunkSize) {
      const chunk = payloads.slice(idx, idx + chunkSize);
      const chunkNo = Math.floor(idx / chunkSize) + 1;
      const insertData = chunk
        .filter(({ rowNum, data }) => {
          if (duplicateRowSet.has(rowNum)) return false;
          const d = data as { country: string; phoneNormalized: string };
          const key = businessUniqueKey(d.country, d.phoneNormalized);
          if (allConflicts.has(key)) {
            failedItems.push({ rowNum, reason: "資料庫已存在相同國家+電話" });
            return false;
          }
          allConflicts.add(key);
          return true;
        })
        .map((x) => x.data);
      if (insertData.length) {
        const promotedSnapshots: Array<Record<string, string>> =
          promotedWritable.length > 0
            ? insertData.map((row) => {
                const attrs =
                  row.attrs && typeof row.attrs === "object" && !Array.isArray(row.attrs)
                    ? { ...(row.attrs as Record<string, unknown>) }
                    : {};
                const snap: Record<string, string> = {};
                for (const p of promotedWritable) {
                  if (Object.prototype.hasOwnProperty.call(attrs, p.key)) {
                    snap[p.key] = String(attrs[p.key] ?? "").trim();
                    delete attrs[p.key];
                  }
                }
                (row as Record<string, unknown>).attrs = attrs;
                return snap;
              })
            : [];
        await prisma.customer.createMany({ data: insertData as never[] });
        if (promotedWritable.length > 0) {
          const fpRows = insertData
            .map((row, i) => ({
              cuid: String((row as Record<string, unknown>).cuid || "").trim(),
              fpValues: promotedSnapshots[i] ?? {},
            }))
            .filter((r) => r.cuid && Object.keys(r.fpValues).length > 0);
          if (fpRows.length) await applyPromotedFpValuesForCuids(prisma, fpRows);
        }
        successRows += insertData.length;
      }
      await importJobRepo.update({
        where: { id: importJobId },
        data: {
          checkpointChunk: chunkNo,
          processedRows: Math.min(idx + chunk.length, payloads.length),
          successRows,
          failedRows: failedItems.length,
        },
      });
      if (queueJobId) {
        await updateJobProgress(prisma, queueJobId, {
          progressDone: Math.min(idx + chunk.length, payloads.length),
          progressTotal: payloads.length,
          message: `已處理 ${Math.min(idx + chunk.length, payloads.length)}/${payloads.length}`,
          result: { successRows, failedRows: failedItems.length },
        });
      }
    }
    const failedRows = failedItems.map((x) => x.rowNum).sort((a, b) => a - b);
    const errorReportPath =
      failedItems.length > 0 ? path.join(importErrorDir, `${importJobId}.csv`) : undefined;
    if (errorReportPath) {
      const csv = `rowNumber,reason\n${failedItems
        .sort((a, b) => a.rowNum - b.rowNum)
        .map((x) => `${x.rowNum},${x.reason}`)
        .join("\n")}\n`;
      fs.writeFileSync(errorReportPath, csv, "utf8");
    }
    await importJobRepo.update({
      where: { id: importJobId },
      data: {
        status: successRows > 0 ? "completed" : "failed",
        canRetry: false,
        insertedCount: successRows,
        processedRows: payloads.length,
        successRows,
        failedRows: failedItems.length,
        errorCount: failedItems.length,
        errorPrimary:
          failedItems.length > 0
            ? `略過 ${failedItems.length} 列（重複或衝突），其餘已完成匯入`
            : null,
        errorRowNumbers: truncateRows(failedRows),
        errorReportPath,
        finishedAt: new Date(),
      },
    });
    if (successRows > 0 && newFields.length > 0) {
      const promotionFields = newFields.map((nf) => {
        const sourceHeader = nf.aliases[0] || nf.name;
        return {
          key: nf.key,
          name: nf.name,
          sourceHeader,
          sampleValues: sheetRows
            .slice(0, 3)
            .map((row) => String(row[sourceHeader] ?? "").trim())
            .filter(Boolean),
        };
      });
      await (prisma as any).jobQueue.create({
        data: {
          source: "field-promotion",
          type: FIELD_PROMOTION_REVIEW_TYPE,
          status: "queued",
          payload: {
            importJobId,
            state: "queued",
            fields: promotionFields,
          },
          title: `欄位升級候選（${promotionFields.length} 欄）`,
          subtitle: "待確認欄位規則",
          dedupeKey: null,
          queuePosition: 0,
          estimatedWaitSec: 0,
          maxAttempts: 1,
        },
      });
    }
    if (queueJobId) {
      await updateJobProgress(prisma, queueJobId, {
        status: successRows > 0 ? "completed" : "failed",
        progressDone: payloads.length,
        progressTotal: payloads.length,
        message: successRows > 0 ? "匯入完成" : "匯入失敗",
        error: successRows > 0 ? null : "no_rows_inserted",
        result: {
          successRows,
          failedRows: failedItems.length,
          insertedCount: successRows,
        },
        finishedAt: new Date(),
      });
    }
  } catch (e) {
    await importJobRepo.update({
      where: { id: importJobId },
      data: {
        status: "failed",
        canRetry: true,
        errorPrimary: e instanceof Error ? e.message : "write_failed",
        finishedAt: new Date(),
      },
    });
    if (queueJobId) {
      await updateJobProgress(prisma, queueJobId, {
        status: "failed",
        message: "匯入失敗",
        error: e instanceof Error ? e.message : "write_failed",
        finishedAt: new Date(),
      });
    }
  }
}
