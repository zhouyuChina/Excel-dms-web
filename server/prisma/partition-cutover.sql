-- Customer partition cutover skeleton (PostgreSQL)
-- Use in maintenance window for 100M+ datasets.

BEGIN;

-- 1) Create partitioned shadow table.
CREATE TABLE IF NOT EXISTS "Customer_v2" (LIKE "Customer" INCLUDING ALL)
PARTITION BY RANGE ("createdAt");

-- 2) Example monthly partitions (add by automation).
CREATE TABLE IF NOT EXISTS "Customer_v2_2026_01"
  PARTITION OF "Customer_v2"
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE IF NOT EXISTS "Customer_v2_2026_02"
  PARTITION OF "Customer_v2"
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- 3) Create local indexes on each partition as needed.
CREATE INDEX IF NOT EXISTS idx_customer_v2_2026_01_updatedat_cuid
  ON "Customer_v2_2026_01" ("updatedAt" DESC, "cuid" ASC);

CREATE INDEX IF NOT EXISTS idx_customer_v2_2026_02_updatedat_cuid
  ON "Customer_v2_2026_02" ("updatedAt" DESC, "cuid" ASC);

COMMIT;

-- 4) Backfill strategy (run outside transaction in batches):
-- INSERT INTO "Customer_v2" SELECT * FROM "Customer" WHERE "createdAt" >= ... LIMIT ...
-- 5) Dual-write then swap table names after validation.
