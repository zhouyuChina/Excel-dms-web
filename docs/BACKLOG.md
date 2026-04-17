# 補齊任務清單（業務流程 ↔ 實作）

> **統一閱讀入口**：[`CRM_MASTER_BRIEF.md`](./CRM_MASTER_BRIEF.md)（專案摘要、DB 事實對齊、文件地圖）。本檔保留完整任務細項。  
> **長期規格／持續演進**（不以此檔「永遠未完成」者）：見 [`LONG_TERM_SPEC.md`](./LONG_TERM_SPEC.md)。

> 狀態更新（2026-04-15）：**P0/P1 主流程已落地（含任務中心）**；長期優化自本檔拆至 `LONG_TERM_SPEC.md`。

優先級：**P0** 先打通主流程 → **P1** 資料寫入與批次 → **P2** 欄位與進階 → **P3** 稽核與上線準備。

---

## P0 — 主檔讀寫與匯入／匯出骨架

| # | 任務 | 狀態 | 說明 |
|---|------|------|------|
| P0-1 | **單筆編輯客戶** | ✅ 已完成 | `PATCH /api/customers/:cuid`；前端改為行內編輯，成功後 refetch。 |
| P0-2 | **單筆刪除** | ✅ 已完成 | `DELETE /api/customers/:cuid`；列上刪除 + 確認。 |
| P0-3 | **批次刪除** | ✅ 已完成 | `POST /api/customers/bulk-delete` body `{ cuids: string[] }`；已接現有勾選 UI。 |
| P0-4 | **匯入 Job（非同步）** | ✅ 已完成 | `POST /api/imports`；整批成功才寫入，失敗回主因與行號。 |
| P0-5 | **匯入接線** | ✅ 已完成 | `ImportModal` 上傳 + country/provider，顯示結果並刷新列表。 |
| P0-6 | **匯出 Job** | ✅ 已完成 | `POST /api/exports`；依篩選快照產檔並標記已匯出。 |
| P0-7 | **快速匯出接線** | ✅ 已完成 | `ExportModal` 已串接匯出流程與刷新。 |
| P0-8 | **匯出狀態與紅點** | ✅ 已完成 | 已區分錯誤紅點與匯出標記，刪除匯出紀錄可同步狀態。 |
| P0-9 | **匯出中心頁** | ✅ 已完成 | 已改接 `GET /api/exports`，支援下載與刪除。 |

---

## P1 — 工具選單與進階查詢

> 狀態更新（2026-04-13）：**P1 已完成第一版**（含清理無效與限制載入/抽樣）。

| # | 任務 | 狀態 | 說明 |
|---|------|------|------|
| P1-1 | **更新資料（檔案）** | ✅ 已完成（第一版） | `POST /api/jobs/update-by-file`；空白不覆蓋。 |
| P1-2 | **合併重複** | ✅ 已完成 | `POST /api/jobs/merge-duplicates`；已支援保留策略與欄位策略。 |
| P1-3 | **合併欄位** | ✅ 已完成（第一版） | `POST /api/jobs/merge-fields` + 預覽 API；禁止刪系統欄。 |
| P1-4 | **添加備註** | ✅ 已完成 | 寫入 `attrs`，支援 selected/filtered/all。 |
| P1-5 | **清理無效** | ✅ 已完成（第一版） | `POST /api/jobs/clean-invalid`；預覽、多規則、隔離／刪除、隔離審核頁、任務中心可追；國別規則見 `phoneCountryRules.ts`。**再擴充（規則矩陣、誤判收斂）**為長期項 → [`LONG_TERM_SPEC.md`](./LONG_TERM_SPEC.md) §2。 |
| P1-6 | **限制載入／抽樣** | ✅ 已完成 | 列表 API 支援 `cap`、`sampleMode` 並已與 UI 對齊。 |

---

## P2 — 欄位管理與單一真相來源

| # | 任務 | 狀態 | 說明 |
|---|------|------|------|
| P2-1 | **欄位定義 CRUD** | ✅ 已完成 | `POST/PATCH/DELETE /api/field-definitions`；`is_system` 禁止刪。 |
| P2-2 | **分組 CRUD** | ✅ 已完成（第一版） | `POST/PATCH/DELETE /api/field-groups`；`FieldManagementPage` 分組管理分頁已接線。 |
| P2-3 | **欄位模板** | ❌ **已移除**（2026-04） | 與 **分組一鍵預設可見** 重疊；`/api/field-templates` 與 `FieldTemplateTab` 已自前後端移除，見 `FIELD_MANAGEMENT_REFACTOR.md` §6.5。 |
| P2-4 | **前端改接 API** | ✅ 已完成（第二版） | `FieldManagementPage` 欄位／分組 CRUD 已接線；原模板接線已隨 P2-3 移除。 |
| P2-5 | **動態欄位與主檔** | ✅ 已完成（第一版） | 匯入新欄建立 `field_definitions`，值寫入 `Customer.attrs`。 |

---

## P3 — 稽核、復原、身分、效能

| # | 任務 | 狀態 | 說明 |
|---|------|------|------|
| P3-1 | **audit_logs** | ✅ 已完成（第一版） | 已支援關鍵操作寫入稽核紀錄，並提供 `GET /api/audit-logs` 查詢與前端檢視頁。 |
| P3-2 | **可復原** | ✅ 已完成（第一版） | 已提供快照建立/列表/還原 API，並接入備份還原頁（admin）。 |
| P3-3 | **登入／角色** | ✅ 已完成（第一版） | 已提供登入 API、JWT token、前端路由守衛與 admin 功能限制。 |
| P3-4 | **億級演進** | 🟡 進行中（Phase 2 local-cutover 完成） | Phase 1：keyset-only、JobQueue（merge/import）已落地；Phase 2：獨立 worker + partition drill/backfill + 本機 cutover 已完成，剩 staging/prod 正式 cutover。 |
| P3-5 | **備份還原** | 🟡 部分完成 | UI 快照流程見 `BACKUP_DRILL_RUNBOOK.md`；可攜 SQL：`cd server && npm run backup:pg-dump`（需本機 `pg_dump` 與 `DATABASE_URL`）。 |
| P3-6 | **任務 DB 佇列** | ✅ 已完成（第一版） | merge-fields 已改為 `JobQueue`，支援 dedupe 與 queue meta。 |
| P3-7 | **備註事件流** | ✅ 已完成（第一版） | 新增 `RemarkEvent` append-only 寫入與 customer 讀模型欄位。 |

---

## 技術債（可並行）

- [x] Prisma 設定：已改為 `prisma.config.ts`（舊 deprecated 設定已移除）。
- [x] `ExportModal` 顯示「將匯出 N 筆」改為即時 **total**（與篩選一致；開啟時重抓並顯示載入中）。
- [x] 統一錯誤處理與 toast 文案（**第一階段**）：共用 `formatApiThrownError` 於匯入／匯出／清理無效／合併欄位／任務中心重試與下載；其餘頁面可續收斂。
- [x] 任務中心後端聚合 API（`GET /api/jobs` + source/status 篩選）已完成。
- [x] 任務中心 SSE 第一版已上線（**斷線重連 + `GET /api/jobs` fallback**；並保留輪詢）。
- [x] `JobQueue` 拆分為獨立 worker 進程（`src/worker.ts` + `worker:dev`）。
- [x] 分區切換演練檢核腳本（`partition:drill`）已補齊（backfill/rollback 檢核）。

## P3-4 階段區分（億級演進）

> 執行入口：[`SCALING_EXECUTION_ONE_PAGER.md`](./SCALING_EXECUTION_ONE_PAGER.md)（先判斷環境，再選重建式或遷移式）。

- **Phase 1（已完成）**
  - keyset-only 查詢契約已切換（停用 offset 模式）。
  - merge-fields / import 任務已統一接入 `JobQueue`（含 queue meta 與進度）。
  - `RemarkEvent + Customer 讀模型` 已上線，備註寫入/查詢路徑已拆分。
  - 效能基線索引與壓測腳本已具備（`perf-indexes.sql`、`perf:loadtest`）。
- **Phase 2（維運／穩定化剩項）**
  - 分區正式 cutover（staging/prod rename swap 彩排 + 回滾驗證 + 上線窗口執行）。
  - 任務中心 SSE：已加 **斷線重連 + `GET /api/jobs` fallback**；heartbeat／metrics／監控告警仍屬可選強化。

---

## 長期規格（不佔用本檔「未完成」勾選）

以下類型改列 **[`LONG_TERM_SPEC.md`](./LONG_TERM_SPEC.md)**，避免 backlog 永遠顯示做不完：

- 清理無效／國別電話／Email 等**持續收斂**。
- P1 工具模組**第二版**（預覽指標、稽核、可回復等）。
- 億級／分區／備份等**維運窗口**事項。
- 可選技術強化（SSE heartbeat、metrics 等）。

**已完成的歷史延伸**（僅存檔，不再用 ⬜ 追蹤）：

- [x] **合併欄位高風險門檻設定化**（第一版）：後端 `MERGE_FIELDS_*_RISK_THRESHOLD`（env）；預覽回傳 `riskThresholds`；前端二次確認門檻以 API 為準。
- [x] **Export 任務中心化 Phase A/B/C**；**查詢優化檢核表**（`QUERY_OPTIMIZATION_CHECKLIST.md`）。

---

## 建議迭代順序（衝刺）

1. **Sprint A**：P0-1～P0-3 + P0-4～P0-5（能匯入、能改刪）  
2. **Sprint B**：P0-6～P0-9（能匯出、匯出中心、標記）  
3. **Sprint C**：P1 全線 + P1-6  
4. **Sprint D**：P2  
5. **Sprint E**：P3 依上線時程  

（實際切分可依人力調整。）
