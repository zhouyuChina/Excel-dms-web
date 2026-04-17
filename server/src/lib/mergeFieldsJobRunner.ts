import type { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "./auditLog.js";
import { getJob, updateJobProgress } from "./jobQueue.js";
import {
  applyPromotedFpValuesForCuids,
  loadPromotedWritableColumns,
  stripPromotedKeysToFpValues,
  syncPromotedColumnsForCuids,
} from "./promotedSync.js";

type MergeFieldsStrategy = "prioritize_non_empty" | "keep_first" | "keep_last" | "concatenate";
type SourceFieldHandling = "hide_field" | "keep_field" | "delete_field";

function slugKey(input: string): string {
  const s = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s || "field";
}

function computeMergedValue(values: string[], mergeStrategy: MergeFieldsStrategy): string {
  if (mergeStrategy === "keep_first") return values[0] || "";
  if (mergeStrategy === "keep_last") return values[values.length - 1] || "";
  if (mergeStrategy === "concatenate") return values.filter(Boolean).join(" | ");
  return values.find(Boolean) || "";
}

export async function runMergeFieldsQueueJob(prisma: PrismaClient, jobId: string) {
  const current = await getJob(prisma, jobId);
  if (!current) return;
  await updateJobProgress(prisma, jobId, {
    status: "processing",
    message: "開始處理欄位合併",
    queuePosition: 0,
    estimatedWaitSec: 0,
  });
  const payload = (current.payload || {}) as {
    sourceKeys?: string[];
    targetName?: string;
    mergeStrategy?: MergeFieldsStrategy;
    sourceFieldHandling?: SourceFieldHandling;
  };
  const runSourceKeys = Array.isArray(payload.sourceKeys) ? payload.sourceKeys.map(String) : [];
  const runTargetName = String(payload.targetName || "");
  const runMergeStrategy = (payload.mergeStrategy || "prioritize_non_empty") as MergeFieldsStrategy;
  const runSourceFieldHandling = (payload.sourceFieldHandling || "hide_field") as SourceFieldHandling;

  if (runSourceKeys.length < 2 || !runTargetName) {
    await updateJobProgress(prisma, jobId, {
      status: "failed",
      message: "欄位合併失敗",
      error: "invalid_merge_fields_payload",
      finishedAt: new Date(),
    });
    return;
  }
  try {
    const target = await prisma.fieldDefinition.findFirst({
      where: { name: runTargetName },
    });
    let finalTarget = target;
    if (!finalTarget) {
      const maxSort = await prisma.fieldDefinition.aggregate({ _max: { sortOrder: true } });
      finalTarget = await prisma.fieldDefinition.create({
        data: {
          key: slugKey(runTargetName),
          name: runTargetName,
          uiColor: "bg-gray-500",
          type: "文字",
          category: "",
          aliases: [runTargetName],
          source: "manual",
          isRequired: false,
          isSystem: false,
          defaultVisible: true,
          isExportable: true,
          sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
          groupId: null,
        },
      });
    }
    if (!finalTarget) throw new Error("target_field_create_failed");
    const targetKey = finalTarget.key;

    const rows = await prisma.customer.findMany({
      select: { cuid: true, attrs: true },
      take: 200_000,
    });
    const promotedWritable = await loadPromotedWritableColumns(prisma);
    await updateJobProgress(prisma, jobId, {
      progressTotal: rows.length,
      progressDone: 0,
      message: "開始更新資料列",
    });
    const chunkSize = 500;
    let changedRows = 0;
    const touchedCuids: string[] = [];
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const fpBatch: Array<{ cuid: string; fpValues: Record<string, string> }> = [];
      for (const row of chunk) {
        const attrs =
          row.attrs && typeof row.attrs === "object" && !Array.isArray(row.attrs)
            ? { ...(row.attrs as Record<string, unknown>) }
            : {};
        const values = runSourceKeys.map((k) => String(attrs[k] ?? "").trim());
        const merged = computeMergedValue(values, runMergeStrategy);
        const currentTarget = String(attrs[targetKey] ?? "").trim();
        attrs[targetKey] = merged;
        if (runSourceFieldHandling === "delete_field") {
          for (const k of runSourceKeys) delete attrs[k];
        }
        if (merged !== currentTarget) changedRows += 1;
        const { attrs: cleanAttrs, fpValues } = stripPromotedKeysToFpValues(attrs, promotedWritable);
        if (Object.keys(fpValues).length > 0) fpBatch.push({ cuid: String(row.cuid), fpValues });
        await prisma.customer.update({
          where: { cuid: row.cuid },
          data: { attrs: cleanAttrs as any },
        });
        touchedCuids.push(String(row.cuid));
      }
      if (fpBatch.length) await applyPromotedFpValuesForCuids(prisma, fpBatch);
      const done = Math.min(i + chunk.length, rows.length);
      await updateJobProgress(prisma, jobId, {
        progressDone: done,
        progressTotal: rows.length,
        message: `已處理 ${done}/${rows.length}`,
        result: { changedRows, targetKey, targetName: runTargetName },
      });
    }
    await syncPromotedColumnsForCuids(prisma, touchedCuids);
    const sourceKeysToHandle = runSourceKeys.filter((k) => k !== targetKey);
    if (runSourceFieldHandling === "hide_field") {
      await prisma.fieldDefinition.updateMany({
        where: { key: { in: sourceKeysToHandle } },
        data: { defaultVisible: false },
      });
    } else if (runSourceFieldHandling === "delete_field") {
      await prisma.fieldDefinition.deleteMany({
        where: { key: { in: sourceKeysToHandle } },
      });
    }
    await updateJobProgress(prisma, jobId, {
      status: "completed",
      message: "欄位合併完成",
      finishedAt: new Date(),
      result: { changedRows, targetKey, targetName: runTargetName },
    });
    await writeAuditLog({
      action: "field-definition.merge-fields",
      targetType: "field-definition",
      targetId: targetKey,
      detail: {
        sourceKeys: runSourceKeys,
        mergeStrategy: runMergeStrategy,
        sourceFieldHandling: runSourceFieldHandling,
        changedRows,
      },
    });
  } catch (e) {
    await updateJobProgress(prisma, jobId, {
      status: "failed",
      message: "欄位合併失敗",
      error: e instanceof Error ? e.message : "merge_fields_failed",
      finishedAt: new Date(),
    });
  }
}
