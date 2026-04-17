# 欄位升級（field-promotion）— DB 遷移與上線策略

> **目的**：把「`Customer` 上動態長出 `fp_*` 欄位」的**現況行為**、**與 Prisma schema 的關係**、**上線／回滾／驗證順序**寫成單一依據，供維運與後續程式收斂對照。  
> **相關**：流程與 UI 見 [`FIELD_PROMOTION_HANDOFF.md`](./FIELD_PROMOTION_HANDOFF.md)；專案總索引見 [`CRM_MASTER_BRIEF.md`](./CRM_MASTER_BRIEF.md)。

**最後更新**：2026-04-17

---

## 1. 名詞與事實來源

| 名詞 | 說明 |
|------|------|
| **promotion / 升級套用** | 將某動態欄（`FieldDefinition.key`）對應的資料，遷移到 `Customer` 表上的固定欄 `fp_*`，並更新 metadata。 |
| **`fp_*` 欄位** | 由 `field_key` 正規化後加上前綴 `fp_` 的 PostgreSQL 欄位（實作：`server/src/lib/fieldPromotionSql.ts` 的 `toPromotedColumnName`）。長度上限 63 字元（PostgreSQL identifier）。 |
| **`attrs`** | `Customer.attrs` JSONB；升級前資料主要存此；升級後可與 `fp_*` 並存過渡，清理見 HANDOFF §9。 |
| **真相來源（metadata）** | `FieldDefinition.storageMode`、`promotionStatus` 等；與實際 DB 欄位不一致時稱 **漂移**，見本文 §6。 |

**Prisma 現況**：`server/prisma/schema.prisma` 的 `Customer` **未宣告**各 `fp_*` 欄位；執行期以 raw SQL `ALTER TABLE` / `CREATE INDEX` 變更實體表結構。Prisma Client 讀寫仍透過已知欄位 + `$queryRaw` / `$executeRaw` 等路徑處理動態欄（見 `customers.ts`、`importJobRunner.ts` 等）。

---

## 2. 現行套用行為（Runtime DDL，已落地）

套用由 **`field-promotion-apply`** 佇列任務觸發，實作於：

- `server/src/lib/fieldPromotionJobRunner.ts`（主要邏輯）
- 觸發時機：任務中心規則確認後產生 plan → 使用者可選「下次重啟套用」→ API/worker 啟動時排入佇列並執行（見 `server/src/index.ts`、`server/src/worker.ts`、`fieldPromotionScheduling.ts`）

**單次套用對單一欄位（簡化順序）**：

1. 確認／建立欄位：`ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "<fp_*>" TEXT`（必要時處理舊版雙重前綴欄名 rename）。
2. 若規則允許篩選或排序：`CREATE INDEX IF NOT EXISTS ... ON "Customer" ("<fp_*>")`。
3. 回填：`UPDATE "Customer" SET "<fp_*>" = COALESCE(NULLIF(attrs->>'<key>', ''), "<fp_*>") WHERE attrs ? '<key>'`（語意以程式為準）。
4. 成功後：更新 `JobQueue` 結果、`FieldDefinition` 設為 `storageMode=promoted`、`promotionStatus=applied` 等。

**意義**：這是 **「以應用程式驅動的 schema 演進」**，不是 `prisma migrate` 每次自動產出的靜態 migration 檔。

---

## 3. 策略分層：三種收斂方向（可並存規劃）

維運上建議把「文件與證據」和「工具鏈」分開看：

### 3.1 策略 A — 維持 Runtime DDL 為權威（短期最務實）

**適用**：欄位組合依客戶／環境差異大、不想為每個 `fp_*` 維護一支 Prisma migration。

**必備配套**：

- 每次套用後保留 **可查證據**：`JobQueue.result`（含 `applyReport`、`appliedColumns`）、稽核若可則記一筆。
- **上線前**：在 staging 對同一套 `FieldDefinition` + 樣本資料跑完整套用與列表／篩選驗證（見 `FULL_SCALE_VALIDATION.md` 與 HANDOFF）。
- **漂移**：啟動時 `reconcilePromotedMetadataDrift`（`promotedSync.ts`）會把「metadata 已 applied 但 DB 無欄」降級為 `dynamic` + `failed`；維運應把此視為 **需介入事件**（見 §6）。

**優點**：與現有程式一致、不需立刻改 Prisma schema。  
**缺點**：ORM 模型與實體表不完全一致；新環境還原 DB 時若只還原資料不含結構演進歷史，需依 metadata 或任務紀錄重跑套用／手動補欄。

### 3.2 策略 B — 版本化 SQL migration（中期建議）

**做法**：每次在 production 執行「升級套用」前或後，由維運或 CI 產出 **可追溯的 SQL 檔**（例如 `server/prisma/migrations_manual/20260417_fp_custom_field_a.sql`），內容與 runner 行為對齊（`ADD COLUMN`、`CREATE INDEX`、`UPDATE` 回填）。

**適用**：合規／變更審查需要「先有腳本、再執行」；或多節點部署要與 DBA  review。

**與 Prisma**：可放在 repo 內與 `prisma/migrations` **分目錄**，避免 `prisma migrate` 與手寫 DDL 混線；執行可用 `psql -f` 或內部 runbook，不一定要綁 `prisma migrate deploy`。

**回滾**：見 §5；DROP COLUMN 通常不寫進自動腳本，需獨立評估。

### 3.3 策略 C — Prisma schema 靜態化部分 `fp_*`（長期選項）

**適用**：欄位集合在某一環境已 **穩定且有限**，願意每次加欄發版。

**作法**：將已確定的 `fp_*` 寫入 `schema.prisma` 的 `Customer` 模型 → `prisma migrate diff` / 正式 migration → 部署；**之後**可逐步讓 runner 改為「僅在過渡環境執行」或僅做回填。

**限制**：若產品語意是「任意多個自訂欄都可升級」，靜態 schema 無法窮舉所有可能 key；實務上常變成 **「熱門欄位進 schema，其餘仍 dynamic」** 的混合模型。

**建議**：在採用 C 前，先完成策略 B 的「每次變更都有 SQL 快照」，再挑欄位收斂進 Prisma。

---

## 4. 上線順序（建議 checklist）

以下順序適用 **單一環境首次套用** 或 **新欄位升級上線**：

1. **備份**：整庫或至少 `Customer` + `FieldDefinition` + `JobQueue`（見 `BACKUP_DRILL_RUNBOOK.md`、`npm run backup:pg-dump`）。
2. **凍結寫入（選配）**：大量併發寫入時，可排維護窗或先完成「排入下次重啟」以降低半套狀態時間。
3. **確認任務 payload**：規則、`plan.fields` 正確；失敗時 `lastError` 可讀。
4. **執行套用**：由任務流程觸發（或 staging 先跑）。
5. **驗證**：
   - `information_schema.columns` 確認 `fp_*` 存在；
   - 列表／篩選／排序抽樣（promoted 路徑）；
   - mismatch 報表（HANDOFF cleanup API）必要時匯出 CSV。
6. **應用程式切換**：確保讀寫路徑已 **fp 優先、attrs 過渡**（見 backlog／HANDOFF「尚未全面切換」項）。
7. **attrs 清理**：僅在驗證與 mismatch=0 策略允許時，走 **人工確認** 的 cleanup（HANDOFF §9）。

---

## 5. 回滾（Rollback）語意

| 情境 | 建議作法 |
|------|----------|
| **套用失敗（transaction 前即失敗或 job 標 failed）** | 以 `JobQueue` / `FieldDefinition.promotionStatus` 為準；通常 **尚未**或 **部分** 加欄／索引。部分加欄時需 DBA 依 `information_schema` 判斷是否手動 `DROP INDEX` / `DROP COLUMN`（注意資料丟失）。 |
| **metadata 與 DB 不一致（漂移）** | 現行程式會將該欄 metadata 降級（`promotedSync.ts`）；**不會**自動刪除已存在的 `fp_*` 欄，避免誤刪資料。 |
| **業務要求回到「僅 attrs」** | 需 **營運決策**：是否保留 `fp_*` 欄位僅不讀、或 `ALTER DROP COLUMN`（強烈建議先備份與確認無依賴索引／視圖）。 |
| **整庫還原** | 使用事前備份／快照；還原後 `FieldDefinition` 與實體欄位需一致，必要時重跑套用或重算 drift。 |

**原則**：**DROP COLUMN 不作為預設自動回滾步驟**；預設回滾是 **狀態與讀寫路徑** 回退，實體欄位保留直到另有 migration 或手動處理。

---

## 6. 漂移（Drift）與監控

**定義**：`FieldDefinition` 顯示已升級（例如 `storageMode=promoted` 且 `promotionStatus=applied`），但 `Customer` 上不存在對應 `fp_*` 欄。

**現行程式**：`findPromotedMetadataDrift` / `reconcilePromotedMetadataDrift`（`promotedSync.ts`）；API 與 worker 啟動時會 reconcile 並 `console.warn`。

**可查 API**：`GET /api/field-definitions/promotion-drift` 回傳 `count` 與 `drift[]`（`key` / `expectedColumn`），不修改資料；與啟動時 `reconcilePromotedMetadataDrift` 使用同一偵測邏輯。

**離線檢查**：`cd server && npm run field-promotion:drift-check`（腳本 `scripts/field-promotion-drift-check.ts`），發現漂移時 **exit code 1**，可接 CI／部署探針。

**維運建議**：

- 將 **reconcile 筆數 > 0** 或 **drift-check 失敗** 納入部署後檢查或監控（日後可擴充為稽核寫入／告警）。
- 根因常見：還原了舊 DB、手動改表、套用 job 失敗後人工改 metadata。

---

## 7. 與 Prisma `migrate` / `db push` 的邊界

| 工具 | 與本功能的關係 |
|------|----------------|
| **`prisma migrate`** | 管理 **schema.prisma 有宣告**的變更；**不**自動管理任意 `fp_*`。若採策略 C，僅遷移「已寫進 schema」的欄位。 |
| **`db push`** | 開發環境快速對齊 schema；**不**取代 production 變更審查；動態 `fp_*` 仍可能只存在於 DB 而不在 schema。 |
| **field-promotion runner** | 目前 **權威的加欄／索引／回填** 路徑之一；與 migrate 並存時，須在 runbook 註明「誰先誰後」，避免重複 `ADD COLUMN`（現有 SQL 使用 `IF NOT EXISTS` 可降低衝突）。 |

---

## 8. 文件維護

- 若套用 runner 的 SQL 語意或順序變更，**請同步更新本文 §2** 與 `FIELD_PROMOTION_HANDOFF.md` 相關段落。
- 若正式採用策略 B 或 C，在 **`CRM_MASTER_BRIEF.md` §七** 附錄可加一行連回本檔執行步驟摘要。

---

## 9. 快速參考：關鍵檔案

| 檔案 | 角色 |
|------|------|
| `server/src/lib/fieldPromotionJobRunner.ts` | 套用：DDL、索引、回填、結果寫入 |
| `server/src/lib/fieldPromotionSql.ts` | 欄名正規化與 quote |
| `server/src/lib/promotedSync.ts` | 漂移偵測、依 cuid 同步 attrs→fp |
| `server/src/lib/fieldPromotionScheduling.ts` | 重啟後將 scheduled 任務改回 queued |
| `server/prisma/schema.prisma` | `Customer` 核心欄位 + `attrs`；**不含**動態 `fp_*` |
