-- 100M-scale query baseline for Customer table (PostgreSQL)
-- Run after `prisma db push` in production-like environments.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Stable keyset pagination index (updatedAt + cuid).
CREATE INDEX IF NOT EXISTS idx_customer_updatedat_cuid
  ON "Customer" ("updatedAt" DESC, "cuid" ASC);

-- Business-unique lookup / dedupe path.
CREATE INDEX IF NOT EXISTS idx_customer_country_phone_normalized
  ON "Customer" ("country", "phoneNormalized");

-- Frequent filter + sort combinations.
CREATE INDEX IF NOT EXISTS idx_customer_country_provider_updatedat_cuid
  ON "Customer" ("country", "provider", "updatedAt" DESC, "cuid" ASC);

CREATE INDEX IF NOT EXISTS idx_customer_provider_updatedat_cuid
  ON "Customer" ("provider", "updatedAt" DESC, "cuid" ASC);

-- Export status filters (non-empty exportRecord = exported).
CREATE INDEX IF NOT EXISTS idx_customer_exportrecord_updatedat_cuid
  ON "Customer" ("exportRecord", "updatedAt" DESC, "cuid" ASC);

CREATE INDEX IF NOT EXISTS idx_customer_name_trgm
  ON "Customer" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customer_email_trgm
  ON "Customer" USING GIN ("email" gin_trgm_ops);

-- Read-model fields for remark filtering.
CREATE INDEX IF NOT EXISTS idx_customer_remark_updatedat
  ON "Customer" ("remarkUpdatedAt" DESC, "updatedAt" DESC, "cuid" ASC);

-- Queue scheduler indexes.
CREATE INDEX IF NOT EXISTS idx_jobqueue_source_status_createdat
  ON "JobQueue" ("source", "status", "createdAt" ASC);

CREATE INDEX IF NOT EXISTS idx_jobqueue_dedupe_status
  ON "JobQueue" ("dedupeKey", "status");

-- Remark events append-only read path.
CREATE INDEX IF NOT EXISTS idx_remarkevent_cuid_createdat
  ON "RemarkEvent" ("cuid", "createdAt" DESC);

-- Dynamic JSON `attrs`（與 Prisma Json 對應之 jsonb）：一般 GIN 有助等值／包含類條件，
-- 「包含」文字若仍極慢，請再依常查鍵加 expression index（見下段註解）。
-- 大表建立索引請預留時間與磁碟；必要時改在維護窗單獨執行 CREATE INDEX CONCURRENTLY。
CREATE INDEX IF NOT EXISTS idx_customer_attrs_gin
  ON "Customer" USING GIN (attrs jsonb_ops);

-- 若某動態鍵極常用（例如固定匯入欄位），可再加單鍵 btree（替換鍵名）：
-- CREATE INDEX IF NOT EXISTS idx_customer_attrs_hot_key
--   ON "Customer" ((attrs ->> 'your_field_key'));

COMMIT;

-- Optional partition migration skeleton:
-- 1) create Customer_v2 PARTITION BY RANGE("createdAt")
-- 2) create monthly partitions and matching local indexes
-- 3) backfill in batches by createdAt
-- 4) dual-write + read switch
-- 5) table swap in maintenance window
