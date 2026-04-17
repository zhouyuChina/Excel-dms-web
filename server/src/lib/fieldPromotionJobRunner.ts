import type { PrismaClient } from "@prisma/client";
import {
  buildFieldPromotionPlan,
  FIELD_PROMOTION_APPLY_TYPE,
  FIELD_PROMOTION_PLAN_TYPE,
  getFieldPromotionStateLabel,
  parseFieldPromotionPayload,
} from "./fieldPromotion.js";
import {
  quoteIdentifier,
  resolvePromotedColumnName,
  toPromotedColumnName,
} from "./fieldPromotionSql.js";

export async function runFieldPromotionQueueJob(prisma: PrismaClient, jobId: string) {
  const repo = (prisma as any).jobQueue;
  const fieldRepo = (prisma as any).fieldDefinition;
  const row = await repo.findUnique({ where: { id: jobId } });
  if (!row) {
    throw new Error("field_promotion_job_not_found");
  }
  if (String(row.source) !== "field-promotion") {
    throw new Error("not_field_promotion_job");
  }

  const payload = parseFieldPromotionPayload((row as { payload?: unknown }).payload);
  const keys = (payload.fields || []).map((field) => field.key).filter(Boolean);

  if (String(row.type) === FIELD_PROMOTION_PLAN_TYPE) {
    const plan = buildFieldPromotionPlan(payload);
    const plannedFields = plan.fields.map((field) => ({
      ...field,
      targetFixedColumnName: toPromotedColumnName(field.targetFixedColumnKey || field.key),
    }));
    const resolvedPlan = {
      ...plan,
      fields: plannedFields,
    };
    const nextPayload = {
      ...payload,
      state: "pending-maintenance" as const,
      plan: resolvedPlan,
    };
    const now = new Date();

    if (keys.length > 0) {
      await fieldRepo.updateMany({
        where: { key: { in: keys } },
        data: {
          promotionStatus: "pending-maintenance",
          promotionPlan: resolvedPlan as any,
          promotionUpdatedAt: now,
        },
      });
    }

    await repo.update({
      where: { id: jobId },
      data: {
        payload: nextPayload as any,
        status: "completed",
        subtitle: getFieldPromotionStateLabel("pending-maintenance"),
        message: "field_promotion_plan_ready",
        progressDone: 1,
        progressTotal: 1,
        finishedAt: now,
        result: {
          state: "pending-maintenance",
          planVersion: resolvedPlan.version,
          generatedAt: resolvedPlan.generatedAt,
          mode: resolvedPlan.mode,
        },
      },
    });
    return;
  }

  if (String(row.type) === FIELD_PROMOTION_APPLY_TYPE) {
    payload.state = "applying";
    payload.lastError = undefined;
    const startedAt = new Date();
    await repo.update({
      where: { id: jobId },
      data: {
        payload: payload as any,
        status: "processing",
        subtitle: getFieldPromotionStateLabel("applying"),
        message: "field_promotion_applying",
        progressDone: 0,
        progressTotal: 1,
        startedAt,
        finishedAt: null,
        error: null,
        result: null,
      },
    });
    if (keys.length > 0) {
      await fieldRepo.updateMany({
        where: { key: { in: keys } },
        data: {
          promotionStatus: "applying",
          promotionUpdatedAt: startedAt,
        },
      });
    }
    try {
      if (!payload.plan?.fields?.length) {
        throw new Error("field_promotion_plan_missing");
      }
      const appliedColumns: string[] = [];
      const applyReport: Array<{
        key: string;
        column: string;
        backfilledRows: number;
        status: "applied";
      }> = [];
      const existingColumnsRows = (await prisma.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Customer'`
      )) as Array<{ column_name?: string }>;
      const existingColumns = new Set(
        existingColumnsRows.map((row) => String(row.column_name || "").trim()).filter(Boolean)
      );
      for (const field of payload.plan.fields) {
        const sourceKey = String(field.key || "").trim();
        if (!sourceKey) continue;
        const columnName = resolvePromotedColumnName(
          String(field.targetFixedColumnName || ""),
          field.targetFixedColumnKey || sourceKey
        );
        const legacyDoublePrefixed = toPromotedColumnName(columnName);
        const quotedColumn = quoteIdentifier(columnName);
        const quotedSourceKey = sourceKey.replace(/'/g, "''");
        if (!existingColumns.has(columnName) && existingColumns.has(legacyDoublePrefixed)) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE "Customer" RENAME COLUMN ${quoteIdentifier(
              legacyDoublePrefixed
            )} TO ${quotedColumn}`
          );
          existingColumns.delete(legacyDoublePrefixed);
          existingColumns.add(columnName);
        }
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS ${quotedColumn} TEXT`
        );
        existingColumns.add(columnName);
        if (field.rules.enableFilter || field.rules.enableSort) {
          const indexName = `${columnName}_idx`;
          const quotedIndex = quoteIdentifier(indexName.slice(0, 63));
          await prisma.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS ${quotedIndex} ON "Customer" (${quotedColumn})`
          );
        }
        const backfilledRows = await prisma.$executeRawUnsafe(
          `UPDATE "Customer" SET ${quotedColumn} = COALESCE(NULLIF(attrs->>'${quotedSourceKey}', ''), ${quotedColumn}) WHERE attrs ? '${quotedSourceKey}'`
        );
        appliedColumns.push(columnName);
        applyReport.push({
          key: sourceKey,
          column: columnName,
          backfilledRows: Number(backfilledRows || 0),
          status: "applied",
        });
      }
      const finishedAt = new Date();
      payload.state = "applied";
      payload.lastError = undefined;
      await repo.update({
        where: { id: jobId },
        data: {
          payload: payload as any,
          status: "completed",
          subtitle: getFieldPromotionStateLabel("applied"),
          message: "field_promotion_applied",
          error: null,
          progressDone: 1,
          progressTotal: 1,
          finishedAt,
          result: {
            state: "applied",
            appliedColumns,
            applyReport,
            totalBackfilledRows: applyReport.reduce((acc, item) => acc + item.backfilledRows, 0),
            appliedAt: finishedAt.toISOString(),
          },
        },
      });
      if (keys.length > 0) {
        await fieldRepo.updateMany({
          where: { key: { in: keys } },
          data: {
            storageMode: "promoted",
            promotionStatus: "applied",
            promotionUpdatedAt: finishedAt,
          },
        });
      }
      return;
    } catch (error) {
      const failedAt = new Date();
      const technicalDetail = error instanceof Error ? error.message : "field_promotion_apply_failed";
      payload.state = "failed";
      payload.lastError = {
        summary: "固定欄位升級套用失敗，請查看技術細節並回報。",
        technicalDetail,
        failedAt: failedAt.toISOString(),
      };
      await repo.update({
        where: { id: jobId },
        data: {
          payload: payload as any,
          status: "failed",
          subtitle: getFieldPromotionStateLabel("failed"),
          message: payload.lastError.summary,
          error: technicalDetail,
          progressDone: 0,
          progressTotal: 1,
          finishedAt: failedAt,
          result: {
            state: "failed",
            summary: payload.lastError.summary,
            technicalDetail,
          },
        },
      });
      if (keys.length > 0) {
        await fieldRepo.updateMany({
          where: { key: { in: keys } },
          data: {
            promotionStatus: "failed",
            promotionUpdatedAt: failedAt,
          },
        });
      }
      return;
    }
  }

  throw new Error("unsupported_field_promotion_type");
}
