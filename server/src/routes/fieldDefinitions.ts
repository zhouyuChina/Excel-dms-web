import type { Express } from "express";
import { Prisma, type PrismaClient } from "@prisma/client";
import { writeAuditLog } from "../lib/auditLog.js";
import { enqueueJob, getJob, listJobs } from "../lib/jobQueue.js";
import { runMergeFieldsQueueJob } from "../lib/mergeFieldsJobRunner.js";
import { findPromotedMetadataDrift } from "../lib/promotedSync.js";

function toFieldDefinitionDto(f: any) {
  return {
    id: f.id,
    key: f.key,
    name: f.name,
    uiColor: f.uiColor,
    type: f.type,
    category: f.category,
    aliases: Array.isArray(f.aliases) ? (f.aliases as unknown[]) : [],
    source: f.source,
    isRequired: f.isRequired,
    isSystem: f.isSystem,
    defaultVisible: f.defaultVisible,
    isExportable: f.isExportable,
    sortOrder: f.sortOrder,
    group: f.group?.name ?? "",
    groupId: f.groupId,
    storageMode: f.storageMode,
    promotionStatus: f.promotionStatus,
    promotionJobId: f.promotionJobId,
    promotionSourceHeader: f.promotionSourceHeader,
    promotionRules: f.promotionRules ?? null,
    promotionPlan: f.promotionPlan ?? null,
    promotionUpdatedAt: f.promotionUpdatedAt?.toISOString() ?? null,
  };
}

function slugKey(input: string): string {
  const s = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s || "field";
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .slice(0, 50);
}

type MergeFieldsStrategy = "prioritize_non_empty" | "keep_first" | "keep_last" | "concatenate";
type SourceFieldHandling = "hide_field" | "keep_field" | "delete_field";

export async function listMergeFieldsJobs(prisma: PrismaClient, limit = 100) {
  const rows = await listJobs(prisma, { source: "merge-fields", limit: Math.max(1, limit) });
  return rows.map((job: any) => ({
    id: String(job.id),
    status: String(job.status),
    createdAt: new Date(job.createdAt).toISOString(),
    updatedAt: new Date(job.updatedAt).toISOString(),
    totalRows: Number(job.progressTotal ?? 0),
    processedRows: Number(job.progressDone ?? 0),
    changedRows: Number((job.result && (job.result.changedRows as number)) ?? 0),
    targetKey: String((job.result && (job.result.targetKey as string)) || ""),
    targetName: String((job.result && (job.result.targetName as string)) || ""),
    sourceFieldHandling: String((job.payload && (job.payload.sourceFieldHandling as string)) || "keep_field"),
    message: String(job.message || ""),
    error: String(job.error || ""),
    queuePosition: Number(job.queuePosition ?? 0),
    estimatedWaitSec: Number(job.estimatedWaitSec ?? 0),
  }));
}

export function registerFieldDefinitions(app: Express, prisma: PrismaClient) {
  const useExternalWorker = process.env.JOB_EXECUTION_MODE === "worker";
  const mergeFieldsMediumRiskThreshold = Math.max(
    100,
    Number(process.env.MERGE_FIELDS_MEDIUM_RISK_THRESHOLD || 800)
  );
  const mergeFieldsHighRiskThreshold = Math.max(
    mergeFieldsMediumRiskThreshold + 1,
    Number(process.env.MERGE_FIELDS_HIGH_RISK_THRESHOLD || 3000)
  );
  app.get("/api/field-definitions", async (_req, res) => {
    const fields = await prisma.fieldDefinition.findMany({
      orderBy: { sortOrder: "asc" },
      include: { group: true },
    });
    res.json({
      items: fields.map(toFieldDefinitionDto),
    });
  });

  app.post("/api/field-definitions", async (req, res) => {
    const body = req.body as {
      key?: string;
      name?: string;
      uiColor?: string;
      type?: string;
      category?: string;
      isRequired?: boolean;
      isSystem?: boolean;
      defaultVisible?: boolean;
      sortOrder?: number;
      groupId?: string | null;
      aliases?: unknown;
      isExportable?: boolean;
      source?: string;
    };

    const name = String(body.name || "").trim();
    if (!name) return res.status(400).json({ error: "name_required" });

    const requestedKey = String(body.key || "").trim();
    let key = slugKey(requestedKey || name);
    if (["attrs", "createdAt", "updatedAt"].includes(key)) key = `field_${key}`;

    const exists = await prisma.fieldDefinition.findUnique({ where: { key } });
    if (exists) return res.status(409).json({ error: "key_exists" });

    if (body.isSystem) return res.status(400).json({ error: "cannot_create_system_field" });

    const created = await prisma.fieldDefinition.create({
      data: {
        key,
        name,
        uiColor: String(body.uiColor || "bg-gray-500"),
        type: String(body.type || "文字"),
        category: String(body.category || ""),
        aliases: asStringArray(body.aliases),
        source: String(body.source || "manual"),
        isRequired: Boolean(body.isRequired),
        isSystem: false,
        defaultVisible: body.defaultVisible === undefined ? true : Boolean(body.defaultVisible),
        isExportable: body.isExportable === undefined ? true : Boolean(body.isExportable),
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
        groupId: body.groupId ?? null,
        storageMode: "dynamic",
        promotionStatus: "none",
        promotionJobId: null,
        promotionSourceHeader: null,
        promotionRules: Prisma.JsonNull,
        promotionPlan: Prisma.JsonNull,
        promotionUpdatedAt: null,
      },
      include: { group: true },
    });

    res.status(201).json({
      item: toFieldDefinitionDto(created),
    });
    await writeAuditLog({
      action: "field-definition.create",
      targetType: "field-definition",
      targetId: created.id,
      detail: { key: created.key, name: created.name },
    });
  });

  app.patch("/api/field-definitions/:id", async (req, res) => {
    const id = req.params.id;
    const existing = await prisma.fieldDefinition.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "not_found" });

    const body = req.body as {
      name?: string;
      uiColor?: string;
      type?: string;
      category?: string;
      aliases?: unknown;
      source?: string;
      isRequired?: boolean;
      defaultVisible?: boolean;
      isExportable?: boolean;
      sortOrder?: number;
      groupId?: string | null;
    };

    if (existing.isSystem) {
      // 系統欄位仍允許調整顯示/排序/群組/匯出與別名，但禁止改 key 與刪除
    }

    const updated = await prisma.fieldDefinition.update({
      where: { id },
      data: {
        name: body.name === undefined ? undefined : String(body.name).trim(),
        uiColor: body.uiColor === undefined ? undefined : String(body.uiColor),
        type: body.type === undefined ? undefined : String(body.type),
        category: body.category === undefined ? undefined : String(body.category),
        aliases: body.aliases === undefined ? undefined : asStringArray(body.aliases),
        source: body.source === undefined ? undefined : String(body.source),
        isRequired: body.isRequired === undefined ? undefined : Boolean(body.isRequired),
        defaultVisible:
          body.defaultVisible === undefined ? undefined : Boolean(body.defaultVisible),
        isExportable:
          body.isExportable === undefined ? undefined : Boolean(body.isExportable),
        sortOrder:
          body.sortOrder === undefined || !Number.isFinite(Number(body.sortOrder))
            ? undefined
            : Number(body.sortOrder),
        groupId: body.groupId === undefined ? undefined : body.groupId,
      },
      include: { group: true },
    });

    res.json({
      item: toFieldDefinitionDto(updated),
    });
    await writeAuditLog({
      action: "field-definition.patch",
      targetType: "field-definition",
      targetId: updated.id,
      detail: { key: updated.key },
    });
  });

  app.delete("/api/field-definitions/:id", async (req, res) => {
    const id = req.params.id;
    const existing = await prisma.fieldDefinition.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "not_found" });
    if (existing.isSystem) return res.status(400).json({ error: "cannot_delete_system_field" });
    await prisma.fieldDefinition.delete({ where: { id } });
    await writeAuditLog({
      action: "field-definition.delete",
      targetType: "field-definition",
      targetId: id,
      detail: { key: existing.key },
    });
    res.status(204).send();
  });

  app.get("/api/jobs/merge-fields/:jobId", async (req, res) => {
    const job = await getJob(prisma, String(req.params.jobId || ""));
    if (!job) return res.status(404).json({ error: "job_not_found" });
    res.json({
      id: String(job.id),
      status: String(job.status),
      createdAt: new Date(job.createdAt).toISOString(),
      updatedAt: new Date(job.updatedAt).toISOString(),
      totalRows: Number(job.progressTotal ?? 0),
      processedRows: Number(job.progressDone ?? 0),
      changedRows: Number((job.result as any)?.changedRows ?? 0),
      targetKey: String((job.result as any)?.targetKey || ""),
      targetName: String((job.result as any)?.targetName || ""),
      message: String(job.message || ""),
      error: String(job.error || ""),
      queuePosition: Number(job.queuePosition ?? 0),
      estimatedWaitSec: Number(job.estimatedWaitSec ?? 0),
    });
  });

  app.post("/api/jobs/merge-fields", async (req, res) => {
    const body = req.body as {
      sourceKeys?: string[];
      targetName?: string;
      mergeStrategy?: MergeFieldsStrategy;
      sourceFieldHandling?: SourceFieldHandling;
    };

    const sourceKeys = Array.isArray(body.sourceKeys)
      ? [...new Set(body.sourceKeys.map((k) => String(k).trim()).filter(Boolean))]
      : [];
    if (sourceKeys.length < 2) {
      return res.status(400).json({ error: "need_at_least_two_source_fields" });
    }
    const targetName = String(body.targetName || "").trim();
    if (!targetName) return res.status(400).json({ error: "target_name_required" });
    const mergeStrategy = body.mergeStrategy || "prioritize_non_empty";
    const sourceFieldHandling = body.sourceFieldHandling || "hide_field";

    const sources = await prisma.fieldDefinition.findMany({
      where: { key: { in: sourceKeys } },
    });
    if (sources.length !== sourceKeys.length) {
      return res.status(400).json({ error: "source_field_not_found" });
    }
    if (sources.some((s) => s.isSystem)) {
      return res.status(400).json({ error: "cannot_merge_system_fields" });
    }

    const dedupeKey = `merge-fields:${sourceKeys.join(",")}::${targetName}::${mergeStrategy}::${sourceFieldHandling}`;
    const { item: queuedJob, deduped } = await enqueueJob(prisma, {
      source: "merge-fields",
      type: "merge-fields",
      title: `合併欄位：${targetName}`,
      subtitle: "欄位合併任務",
      payload: { sourceKeys, targetName, mergeStrategy, sourceFieldHandling },
      dedupeKey,
      maxAttempts: 2,
    });
    const jobId = String(queuedJob.id);
    if (!useExternalWorker) {
      setImmediate(() => {
        void runMergeFieldsQueueJob(prisma, jobId);
      });
    }
    res.status(202).json({
      jobId,
      status: "queued",
      targetName,
      mergedSourceCount: sourceKeys.length,
      sourceFieldHandling,
      deduped,
      queuePosition: Number((queuedJob as any).queuePosition ?? 0),
      estimatedWaitSec: Number((queuedJob as any).estimatedWaitSec ?? 0),
      taskSummary: `將 ${sourceKeys.length} 個欄位合併到「${targetName}」`,
    });
  });

  app.post("/api/jobs/merge-fields/preview", async (req, res) => {
    const body = req.body as {
      sourceKeys?: string[];
      targetName?: string;
      mergeStrategy?: "prioritize_non_empty" | "keep_first" | "keep_last" | "concatenate";
      sourceFieldHandling?: SourceFieldHandling;
    };

    const sourceKeys = Array.isArray(body.sourceKeys)
      ? [...new Set(body.sourceKeys.map((k) => String(k).trim()).filter(Boolean))]
      : [];
    if (sourceKeys.length < 2) {
      return res.status(400).json({ error: "need_at_least_two_source_fields" });
    }
    const targetName = String(body.targetName || "").trim();
    if (!targetName) return res.status(400).json({ error: "target_name_required" });
    const mergeStrategy = body.mergeStrategy || "prioritize_non_empty";
    const sourceFieldHandling = body.sourceFieldHandling || "hide_field";

    const sources = await prisma.fieldDefinition.findMany({
      where: { key: { in: sourceKeys } },
    });
    if (sources.length !== sourceKeys.length) {
      return res.status(400).json({ error: "source_field_not_found" });
    }
    if (sources.some((s) => s.isSystem)) {
      return res.status(400).json({ error: "cannot_merge_system_fields" });
    }

    const target = await prisma.fieldDefinition.findFirst({
      where: { name: targetName },
      select: { key: true },
    });
    const targetKey = target?.key ?? slugKey(targetName);

    const rows = await prisma.customer.findMany({
      select: { attrs: true },
      take: 200_000,
    });

    let rowsWithAnySourceValue = 0;
    let rowsWillWriteTarget = 0;
    let rowsTargetChanged = 0;

    for (const row of rows) {
      const attrs =
        row.attrs && typeof row.attrs === "object" && !Array.isArray(row.attrs)
          ? (row.attrs as Record<string, unknown>)
          : {};
      const values = sourceKeys.map((k) => String(attrs[k] ?? "").trim());
      const hasAnySource = values.some(Boolean);
      if (hasAnySource) rowsWithAnySourceValue += 1;

      let merged = "";
      if (mergeStrategy === "keep_first") {
        merged = values[0] || "";
      } else if (mergeStrategy === "keep_last") {
        merged = values[values.length - 1] || "";
      } else if (mergeStrategy === "concatenate") {
        merged = values.filter(Boolean).join(" | ");
      } else {
        merged = values.find(Boolean) || "";
      }

      if (merged) rowsWillWriteTarget += 1;
      const currentTarget = String(attrs[targetKey] ?? "").trim();
      if (merged !== currentTarget) rowsTargetChanged += 1;
    }

    const targetExists = Boolean(target?.key);
    const warnings: string[] = [];
    if (!targetExists) warnings.push("目標欄位不存在，送出後會自動建立新欄位。");
    if (rowsTargetChanged >= mergeFieldsMediumRiskThreshold)
      warnings.push("本次變更筆數較大，建議先於離峰時段執行。");
    if (sourceFieldHandling === "delete_field") warnings.push("來源欄位將被刪除，請先確認不需保留。");
    const riskLevel =
      sourceFieldHandling === "delete_field" || rowsTargetChanged >= mergeFieldsHighRiskThreshold
        ? "high"
        : rowsTargetChanged >= mergeFieldsMediumRiskThreshold
        ? "medium"
        : "low";

    res.json({
      totalRows: rows.length,
      rowsWithAnySourceValue,
      rowsWillWriteTarget,
      rowsTargetChanged,
      targetKey,
      targetExists,
      riskLevel,
      warnings,
      riskThresholds: {
        medium: mergeFieldsMediumRiskThreshold,
        high: mergeFieldsHighRiskThreshold,
      },
    });
  });

  app.get("/api/field-definitions/promotion-drift", async (_req, res) => {
    const drift = await findPromotedMetadataDrift(prisma);
    res.json({
      count: drift.length,
      drift,
      summary:
        drift.length === 0
          ? "ok"
          : `有 ${drift.length} 個欄位在 metadata 為已套用升級，但 Customer 表缺少對應固定欄（啟動時 reconcile 會降級為 dynamic + failed）`,
    });
  });
}
