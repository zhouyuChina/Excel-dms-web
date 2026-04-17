import type { PrismaClient } from "@prisma/client";

/**
 * 以 pg_stat / pg_class 的列估計值取代 COUNT(*)，毫秒級回傳。
 * 僅適用於「全表」語意；有 WHERE 時仍應使用精確 count。
 */
export async function getApproximateCustomerRowCount(prisma: PrismaClient): Promise<number | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ estimate: bigint }>>`
      SELECT GREATEST(
        COALESCE(s.n_live_tup::bigint, 0),
        COALESCE(c.reltuples::bigint, 0)
      ) AS estimate
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid AND s.schemaname = n.nspname
      WHERE n.nspname = current_schema()
        AND c.relkind = 'r'
        AND c.relname = 'Customer'
      LIMIT 1
    `;
    const n = Number(rows[0]?.estimate ?? 0);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
  } catch {
    return null;
  }
}
