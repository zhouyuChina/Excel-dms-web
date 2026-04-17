import type { PrismaClient } from "@prisma/client";
import { quoteIdentifier, toPromotedColumnName } from "./fieldPromotionSql.js";

function sqlLiteral(input: unknown): string {
  return `'${String(input ?? "").replace(/'/g, "''")}'`;
}

function chunkItems<T>(items: T[], chunkSize: number): T[][] {
  if (items.length <= chunkSize) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) out.push(items.slice(i, i + chunkSize));
  return out;
}

export async function loadExistingCustomerColumns(prisma: PrismaClient): Promise<Set<string>> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Customer'`
  )) as Array<{ column_name?: string }>;
  return new Set(rows.map((r) => String(r.column_name || "").trim()).filter(Boolean));
}

export async function findPromotedMetadataDrift(prisma: PrismaClient): Promise<
  Array<{ key: string; expectedColumn: string }>
> {
  const fieldDefinitionRepo = (prisma as any).fieldDefinition;
  const promotedDefs: Array<{ key: string }> = await fieldDefinitionRepo.findMany({
    where: { storageMode: "promoted", promotionStatus: "applied" },
    select: { key: true },
  });
  if (!promotedDefs.length) return [];
  const existingColumns = await loadExistingCustomerColumns(prisma);
  return promotedDefs
    .map((x) => {
      const key = String(x.key || "").trim();
      if (!key) return null;
      const expectedColumn = toPromotedColumnName(key);
      if (existingColumns.has(expectedColumn)) return null;
      return { key, expectedColumn };
    })
    .filter((x): x is { key: string; expectedColumn: string } => Boolean(x));
}

export async function reconcilePromotedMetadataDrift(prisma: PrismaClient) {
  const drift = await findPromotedMetadataDrift(prisma);
  if (!drift.length) return { fixed: 0, drift };
  const fieldDefinitionRepo = (prisma as any).fieldDefinition;
  const now = new Date();
  for (const item of drift) {
    await fieldDefinitionRepo.updateMany({
      where: { key: item.key },
      data: {
        storageMode: "dynamic",
        promotionStatus: "failed",
        promotionUpdatedAt: now,
      },
    });
  }
  return { fixed: drift.length, drift };
}

export async function loadPromotedWritableColumns(
  prisma: PrismaClient
): Promise<Array<{ key: string; column: string }>> {
  const fieldDefinitionRepo = (prisma as any).fieldDefinition;
  const promotedDefs: Array<{ key: string }> = await fieldDefinitionRepo.findMany({
    where: { storageMode: "promoted", promotionStatus: "applied" },
    select: { key: true },
  });
  if (!promotedDefs.length) return [];
  const existingColumns = await loadExistingCustomerColumns(prisma);
  return promotedDefs
    .map((x) => {
      const key = String(x.key || "").trim();
      if (!key) return null;
      const column = toPromotedColumnName(key);
      if (!existingColumns.has(column)) return null;
      return { key, column };
    })
    .filter((x): x is { key: string; column: string } => Boolean(x));
}

/**
 * 從 attrs 物件拆出已升級欄位值（寫入 fp_*），其餘留在 attrs。
 */
export function stripPromotedKeysToFpValues(
  attrs: Record<string, unknown>,
  promotedWritable: Array<{ key: string; column: string }>
): { attrs: Record<string, unknown>; fpValues: Record<string, string> } {
  const out = { ...attrs };
  const fpValues: Record<string, string> = {};
  for (const p of promotedWritable) {
    if (!Object.prototype.hasOwnProperty.call(out, p.key)) continue;
    fpValues[p.key] = String(out[p.key] ?? "").trim();
    delete out[p.key];
  }
  return { attrs: out, fpValues };
}

/**
 * 依欄位 key 將字串值批次寫入 Customer.fp_*（不依賴 attrs 內是否仍有該 key）。
 */
export async function applyPromotedFpValuesForCuids(
  prisma: PrismaClient,
  rows: Array<{ cuid: string; fpValues: Record<string, string> }>
): Promise<void> {
  if (!rows.length) return;
  const promotedWritable = await loadPromotedWritableColumns(prisma);
  if (!promotedWritable.length) return;

  for (const p of promotedWritable) {
    const tuples: string[] = [];
    for (const row of rows) {
      const cuid = String(row.cuid || "").trim();
      if (!cuid) continue;
      if (!Object.prototype.hasOwnProperty.call(row.fpValues, p.key)) continue;
      tuples.push(`(${sqlLiteral(cuid)}, ${sqlLiteral(row.fpValues[p.key] ?? "")})`);
    }
    if (!tuples.length) continue;
    const col = quoteIdentifier(p.column);
    await prisma.$executeRawUnsafe(
      `UPDATE "Customer" AS c SET ${col} = d.v::text FROM (VALUES ${tuples.join(", ")}) AS d(cuid, v) WHERE c."cuid" = d.cuid`
    );
  }
}

export async function syncPromotedColumnsForCuids(
  prisma: PrismaClient,
  cuids: string[],
  options?: { clearWhenMissing?: boolean }
) {
  const ids = [...new Set(cuids.map((x) => String(x || "").trim()).filter(Boolean))];
  if (!ids.length) return;
  const promotedWritable = await loadPromotedWritableColumns(prisma);
  if (!promotedWritable.length) return;
  const clearWhenMissing = Boolean(options?.clearWhenMissing);
  for (const chunk of chunkItems(ids, 3000)) {
    const inClause = chunk.map((id) => sqlLiteral(id)).join(", ");
    for (const promoted of promotedWritable) {
      const col = quoteIdentifier(promoted.column);
      const keyLit = promoted.key.replace(/'/g, "''");
      await prisma.$executeRawUnsafe(
        `UPDATE "Customer"
         SET ${col} = CASE
            WHEN attrs ? '${keyLit}' THEN NULLIF(attrs->>'${keyLit}', '')
            ELSE ${clearWhenMissing ? "NULL" : col}
         END
         WHERE "cuid" IN (${inClause})`
      );
    }
  }
}
