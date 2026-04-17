# 100M 整包驗收清單

> **與現況的關係**：本檔是「驗收步驟 + 某次執行紀錄」。**§7 的數字只代表填寫當下那個資料庫**，若之後執行 `db:seed`、`db:push` 或手動改表，影子表可能消失、筆數也會變。  
> **目前環境是否仍有分區／影子表**：一律以 [`SCALING_EXECUTION_ONE_PAGER.md`](./SCALING_EXECUTION_ONE_PAGER.md) 的 SQL／`partition:drill` 為準，勿僅憑 §7 舊紀錄推斷。

## 1. 環境準備

1. `cd server && npm run db:push -- --skip-generate`
2. `npm run db:seed:reset-fields`
3. `npm run dev`（後端）
4. `npm run worker:dev`（獨立 worker，建議另開 terminal）
5. `cd .. && npm run dev`（前端）

## 2. 任務系統驗收（DB 佇列）

- 建立 merge-fields 任務，確認回傳：
  - `deduped`
  - `queuePosition`
  - `estimatedWaitSec`
- 建立 import 任務，確認也回傳：
  - `queuePosition`
  - `estimatedWaitSec`
  - 任務進度會在任務中心持續更新
- 重複送出相同 payload，確認命中 dedupe（同 jobId/或 deduped=true）
- 任務完成後重啟 API，確認任務狀態仍可查。

## 3. 備註事件流驗收

- 執行「添加備註」工具。
- 驗證：
  - `Customer.remarkLatest`、`remarkUpdatedAt` 有更新
  - `GET /api/customers/:cuid/remarks` 可讀到事件列表
  - 稽核記錄存在 `customer.add-remarks`

## 4. 查詢契約驗收（keyset-only）

- `GET /api/customers` 正常回傳 `nextCursor/hasMore`
- 傳 `paginationMode=offset` 應回 `400 keyset_only_mode`

## 5. 壓測（快速版）

執行：

```bash
cd server
npm run perf:loadtest
```

輸出記錄：
- baseline avg/p95
- provider-filter avg/p95
- exported-only avg/p95

## 6. 分區切換演練檢核（Dry-run）

```bash
cd server
npm run partition:drill -- --mode=backfill
npm run partition:drill -- --mode=rollback
```

驗證重點（依 `partition:drill` 實際輸出判讀）：
- **若印出「單表基線、shadow 不存在」**：代表當前庫尚未建立 `Customer_v2` / `customer_p`，此時不適用 `missing in shadow = 0`；需先依遷移劇本或開發重建式建立影子表／分區表後再跑。
- **若進入完整 backfill 輸出**：檢核 `missing in shadow = 0`、shadow 與主表筆數合理、`partition count` 符合預期。
- **rollback**：檢核備援表是否存在（`customer_backup` / `Customer_backup`）、以及文件列出的回切步驟是否仍適用你的表名慣例。
- 演練後 API smoke test 可通過。
## 7. 結果紀錄

- 驗收日期：2026-04-14
- 驗收人：User + Codex
- DB 規模：本機 seed（Customer=6，shadow customer_p=6）
- 查詢 P95：baseline 6ms / provider-filter 4ms / exported-only 4ms
- 備註寫入 P95：
- 任務排隊/完成時間：
- 失敗率與重試成功率：
- 待修正項：待 staging/prod 實施正式 cutover（rename swap）與 rollback 彩排
