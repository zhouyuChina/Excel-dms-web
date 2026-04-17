import type { PrismaClient } from "@prisma/client";
import { parseFieldPromotionPayload } from "./fieldPromotion.js";
import { quoteIdentifier, resolvePromotedColumnName } from "./fieldPromotionSql.js";
import { loadExistingCustomerColumns } from "./promotedSync.js";

function sqlLiteral(input: unknown): string {
  return `'${String(input ?? "").replace(/'/g, "''")}'`;
}

export type FieldPromotionCleanupPreview = {
  generatedAt: string;
  fields: Array<{
    key: string;
    column: string;
    /** DB 尚無此 fp_* 欄（套用未完成或漂移），僅統計 attrs、不比對固定欄 */
    columnMissing?: boolean;
    totalWithAttr: number;
    matchedPromoted: number;
    mismatch: number;
    missingPromoted: number;
  }>;
  totals: {
    totalWithAttr: number;
    matchedPromoted: number;
    mismatch: number;
    missingPromoted: number;
  };
};

export async function buildFieldPromotionCleanupPreview(prisma: PrismaClient, jobPayload: unknown) {
  const payload = parseFieldPromotionPayload(jobPayload);
  const fields = payload.plan?.fields || [];
  const existingColumns = await loadExistingCustomerColumns(prisma);
  const rows: FieldPromotionCleanupPreview["fields"] = [];
  for (const field of fields) {
    const key = String(field.key || "").trim();
    if (!key) continue;
    const column = resolvePromotedColumnName(
      String(field.targetFixedColumnName || ""),
      field.targetFixedColumnKey || key
    );
    const keyLit = key.replace(/'/g, "''");
    if (!existingColumns.has(column)) {
      const sqlAttrsOnly = `SELECT
        COUNT(*) FILTER (WHERE attrs ? '${keyLit}')::bigint AS "totalWithAttr",
        COUNT(*) FILTER (WHERE attrs ? '${keyLit}' AND NULLIF(attrs->>'${keyLit}', '') IS NOT NULL)::bigint AS "missingPromoted"
      FROM "Customer"`;
      const r = (await prisma.$queryRawUnsafe(sqlAttrsOnly)) as Array<Record<string, unknown>>;
      const item = r[0] || {};
      rows.push({
        key,
        column,
        columnMissing: true,
        totalWithAttr: Number(item.totalWithAttr || 0),
        matchedPromoted: 0,
        mismatch: 0,
        missingPromoted: Number(item.missingPromoted || 0),
      });
      continue;
    }
    const col = quoteIdentifier(column);
    const sql = `SELECT
      COUNT(*) FILTER (WHERE attrs ? '${keyLit}')::bigint AS "totalWithAttr",
      COUNT(*) FILTER (WHERE attrs ? '${keyLit}' AND (NULLIF(attrs->>'${keyLit}', '') IS NULL OR ${col} = attrs->>'${keyLit}'))::bigint AS "matchedPromoted",
      COUNT(*) FILTER (WHERE attrs ? '${keyLit}' AND NULLIF(attrs->>'${keyLit}', '') IS NOT NULL AND (${col} IS NULL OR NULLIF(${col}, '') IS NULL))::bigint AS "missingPromoted",
      COUNT(*) FILTER (WHERE attrs ? '${keyLit}' AND NULLIF(attrs->>'${keyLit}', '') IS NOT NULL AND ${col} IS NOT NULL AND ${col} <> attrs->>'${keyLit}')::bigint AS "mismatch"
    FROM "Customer"`;
    const result = (await prisma.$queryRawUnsafe(sql)) as Array<Record<string, unknown>>;
    const item = result[0] || {};
    rows.push({
      key,
      column,
      totalWithAttr: Number(item.totalWithAttr || 0),
      matchedPromoted: Number(item.matchedPromoted || 0),
      mismatch: Number(item.mismatch || 0),
      missingPromoted: Number(item.missingPromoted || 0),
    });
  }
  return {
    generatedAt: new Date().toISOString(),
    fields: rows,
    totals: {
      totalWithAttr: rows.reduce((acc, x) => acc + x.totalWithAttr, 0),
      matchedPromoted: rows.reduce((acc, x) => acc + x.matchedPromoted, 0),
      mismatch: rows.reduce((acc, x) => acc + x.mismatch, 0),
      missingPromoted: rows.reduce((acc, x) => acc + x.missingPromoted, 0),
    },
  } satisfies FieldPromotionCleanupPreview;
}

export async function buildFieldPromotionMismatchRows(
  prisma: PrismaClient,
  jobPayload: unknown,
  limitPerField = 2000
) {
  const payload = parseFieldPromotionPayload(jobPayload);
  const fields = payload.plan?.fields || [];
  const existingColumns = await loadExistingCustomerColumns(prisma);
  const rows: Array<{
    key: string;
    column: string;
    cuid: string;
    attrValue: string;
    promotedValue: string;
  }> = [];
  for (const field of fields) {
    const key = String(field.key || "").trim();
    if (!key) continue;
    const column = resolvePromotedColumnName(
      String(field.targetFixedColumnName || ""),
      field.targetFixedColumnKey || key
    );
    if (!existingColumns.has(column)) continue;
    const col = quoteIdentifier(column);
    const keyLit = key.replace(/'/g, "''");
    const sql = `SELECT
      ${sqlLiteral(key)} AS "key",
      ${sqlLiteral(column)} AS "column",
      "cuid",
      COALESCE(attrs->>'${keyLit}', '') AS "attrValue",
      COALESCE(${col}, '') AS "promotedValue"
    FROM "Customer"
    WHERE attrs ? '${keyLit}'
      AND NULLIF(attrs->>'${keyLit}', '') IS NOT NULL
      AND ${col} IS NOT NULL
      AND ${col} <> attrs->>'${keyLit}'
    ORDER BY "updatedAt" DESC
    LIMIT ${Math.max(1, Math.min(10000, Math.floor(limitPerField)))}`;
    const part = (await prisma.$queryRawUnsafe(sql)) as Array<{
      key: string;
      column: string;
      cuid: string;
      attrValue: string;
      promotedValue: string;
    }>;
    rows.push(...part);
  }
  return rows;
}

export async function applyFieldPromotionCleanup(prisma: PrismaClient, jobId: string, jobPayload: unknown) {
  const payload = parseFieldPromotionPayload(jobPayload);
  const fields = payload.plan?.fields || [];
  const existingColumns = await loadExistingCustomerColumns(prisma);
  const removed: Array<{
    key: string;
    column: string;
    removedRows: number;
    skipped?: boolean;
    skipReason?: string;
  }> = [];
  for (const field of fields) {
    const key = String(field.key || "").trim();
    if (!key) continue;
    const column = resolvePromotedColumnName(
      String(field.targetFixedColumnName || ""),
      field.targetFixedColumnKey || key
    );
    const keyLit = key.replace(/'/g, "''");
    if (!existingColumns.has(column)) {
      removed.push({
        key,
        column,
        removedRows: 0,
        skipped: true,
        skipReason: "promoted_column_missing",
      });
      continue;
    }
    const col = quoteIdentifier(column);
    const sql = `UPDATE "Customer"
      SET attrs = attrs - '${keyLit}'
      WHERE attrs ? '${keyLit}'
        AND (NULLIF(attrs->>'${keyLit}', '') IS NULL OR ${col} = attrs->>'${keyLit}')`;
    const count = await prisma.$executeRawUnsafe(sql);
    removed.push({ key, column, removedRows: Number(count || 0) });
  }
  const appliedAt = new Date().toISOString();
  return {
    jobId,
    appliedAt,
    removed,
    totalRemovedRows: removed.reduce((acc, x) => acc + x.removedRows, 0),
    note: "only removed attrs values that are empty or equal to promoted column",
    idempotencyKey: sqlLiteral(`${jobId}:${appliedAt}`),
  };
}
