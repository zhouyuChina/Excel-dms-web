# CRM（Excel DMS Web）主索引｜專案現況一份搞定

> **用途**：統一取代「昨天／今天散落的多份交接、brief、handoff」的閱讀入口。  
> **維護**：有重大里程碑時更新本檔日期與表格；細節規格仍放在下方「附錄文件」連結。

**最後更新**：2026-04-17

---

## 一、30 秒摘要

- **產品**：客戶主檔管理、匯入／匯出、工具選單、欄位管理、稽核、備份還原、登入角色、**任務中心**（匯入／合併／匯出／**清理無效**等）、**隔離審核**（清理無效延伸）。側欄另有 **統計分析**、**資料驗證** 等模組，多數仍為 **示意／mock UI**（見 **§十**）。
- **業務唯一鍵**：`country + phoneNormalized`（技術主鍵仍為 `cuid`）。
- **主檔**：Prisma 僅 **`Customer` 一個模型**；API 與 UI 都以此為準。
- **長任務**：`JobQueue`（DB）；建議 **API** 與 **worker** 分開跑（見 §七）。
- **舊文件陷阱**：網路上或舊對話若宣稱「本機已分區、`Customer_backup` 仍在」，**未必是你現在連的資料庫**；以 **§二 SQL 實查** 為準。（舊 `HANDOFF`／`SCALING_NOTES` 檔已刪除，內容收斂於本檔；細節可查 git 歷史。）

---

## 二、資料庫：什麼能當「事實」？

### 2.1 請對「目標環境」的 `DATABASE_URL` 執行

```sql
SELECT c.relname::text AS name,
       CASE c.relkind WHEN 'r' THEN 'ordinary' WHEN 'p' THEN 'partitioned_parent' ELSE c.relkind::text END AS kind,
       pg_get_partkeydef(c.oid) AS partition_key
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname ILIKE '%customer%'
  AND c.relkind IN ('r','p')
ORDER BY 1;
```

### 2.2 曾於本機抽樣過的一次結果（僅供對照，**不能代表所有環境**）

- `Customer` 為 **一般表**（非分區父表）。
- 同次查詢內 **未見** `Customer_backup`。
- **結論**：當時該庫 **沒有**「rename-swap 專用備份表」可一鍵切回；若需回滾，靠 **整庫備份／recovery 快照／維運流程**，不要假設一定有 `Customer_backup`。

### 2.3 分區相關檔案（≠ 已在你庫上執行）

| 項目 | 說明 |
|------|------|
| `server/prisma/partition-cutover.sql` | 維運手動執行的遷移**骨架** |
| `npm run partition:drill` | **檢核／演練**腳本，不會自動幫你 cutover |

---

## 三、程式架構速覽（可查 repo）

| 領域 | 重點 |
|------|------|
| 列表查詢 | keyset-only，`server/src/routes/customers.ts` |
| 匯入 | chunk / checkpoint；`JobQueue`；`server/src/routes/imports.ts`、`importJobRunner` |
| 欄位合併 | 非同步 job；`mergeFieldsJobRunner` |
| 匯出 | `JobQueue(source=export)`；拆檔 `server/src/lib/exportJobRunner.ts`，環境變數 `EXPORT_PART_ROWS`（預設 50000）；結果 `result.files[]` |
| 多檔下載 | `GET /api/jobs/:jobId/files/:fileName/download` |
| 任務列表 | `GET /api/jobs`；即時推送 `GET /api/jobs/stream`（**SSE 斷線重連 + 失敗時 fallback 拉 jobs**；前端另有輪詢補強） |
| 前端任務 | `src/lib/jobCenter.ts`、`Header`、`TaskCenterPage`；匯出中心 `ExportCenterPage`（含分檔展開／下載） |
| **清理無效 → 隔離區** | 後端 `server/src/lib/cleanInvalidJobRunner.ts`：`quarantine`／`delete`；無效列寫入 `attrs`（如 `__quarantineSource=clean-invalid`）；佇列來源 `clean-invalid` 納入 **`GET /api/jobs`** 與 worker |
| **隔離審核 UI** | `src/components/business/validation/InvalidQuarantinePage.tsx`；側欄 **「隔離審核」**（`invalid-quarantine`） |
| **清理規則（前端勾選）** | `CleanInvalidModal.tsx`：含 `phone_empty`、`email_invalid`、`phone_country_invalid` 等；預覽／執行 Job |
| **國家＋電話判定** | 共用 **`server/src/lib/phoneCountryRules.ts`**（`isValidPhoneByCountry` 等）；由 `customers.ts`、清理 job 匯入；匯入彈窗 `ImportModal` 提示國家影響驗證；草案見 `docs/PHONE_COUNTRY_RULES_DRAFT.md` |

### 3.1 任務中心相關優化（摘要）

- **統一來源**：`clean-invalid` 與匯入／合併／匯出並列，見 `server/src/routes/jobs.ts`、`TaskCenterPage`（含來源篩選、副標 humanize，例如隔離進度文案）。
- **與清理無效閉環**：`CleanInvalidModal` 可導向隔離相關流程（`onOpenQuarantine`）；完成後仍依現有任務完成事件刷新主表。

---

## 四、任務／版本狀態（合併自 `BACKLOG`）

### 4.1 已完成（精簡）

| 區塊 | 狀態 |
|------|------|
| **P0** 主檔 CRUD、匯入／匯出骨架、匯出中心、紅點 | ✅ |
| **P1** 工具選單多數、限制載入／抽樣 | ✅ |
| **P1-5 清理無效** | ✅ **第一版已完成**（預覽、多規則、隔離／刪除、隔離審核、任務中心）；規則與國別**持續演進**見 `LONG_TERM_SPEC.md`、`PHONE_COUNTRY_RULES_DRAFT.md` |
| **P2** 欄位定義、動態欄位、**分組** | ✅；**欄位模板** 已移除（見 `BACKLOG.md` P2-3、`FIELD_MANAGEMENT_REFACTOR.md` §6.5） |
| **P2** 分組 | ✅ **API CRUD + 分組管理 UI**（細節見 `BACKLOG.md` P2-2） |
| **P3** 稽核、可復原、登入、JobQueue、備註事件流 | ✅ 第一版 |
| **P3** 億級／分區／staging cutover | 🟡 **程式與腳本具備**；是否已在**你的** DB 完成分區 → 只信 §二 SQL |
| **Export** Phase A/B/C（佇列、拆檔、任務中心下載、dedupe 等） | ✅（細節以程式為準） |

### 4.2 待辦／技術債（精簡）

- ~~`ExportModal` 匯出筆數與篩選 **total**~~：✅ 已處理（開啟時重抓 total + 載入提示）。
- ~~錯誤與 toast（高流量路徑）~~：✅ 已共用 `formatApiThrownError`（其餘頁面可續收斂）。
- 清理無效（長期）：**進階規則矩陣**、誤判收斂 → `LONG_TERM_SPEC.md` §2；草案見 `PHONE_COUNTRY_RULES_DRAFT.md`。
- ~~合併欄位高風險門檻~~：後端 **env** + 預覽 `riskThresholds`；前端二次確認與後端預設對齊。
- P3-5：UI 快照演練見 runbook；可攜 SQL：`cd server && npm run backup:pg-dump`（需本機 `pg_dump`）。
- 任務 SSE：**heartbeat／metrics** 仍屬可選強化（重連 + fallback 已見 `jobCenter.ts`）。
- 前端：**統計分析**、**資料驗證** 等仍為示意頁；側欄「系統狀態」為占位 → **§十**、**`LONG_TERM_SPEC.md` §6**。

---

## 五、建議下一步（給實作）

1. 任何文件若宣稱「已分區／有 backup」：先跑 §二 SQL，再改文件敘述。  
2. **前端體驗**：優先將 **§十** 列為「示意」的模組**接 API 或收斂範圍**（避免使用者誤以為是真實營運數字）；細項規劃見 **`LONG_TERM_SPEC.md` §6**。  
3. 產品／長期：清理無效與國別規則**持續收斂**、P3-5 備份演練（快照 + `pg_dump`）→ `LONG_TERM_SPEC.md`。  
4. 上線分區：獨立維運窗口 + `partition-cutover.sql` + 回滾演練（與開發機是否分區無關）。

> 億級/分區執行請優先讀：[`SCALING_EXECUTION_ONE_PAGER.md`](./SCALING_EXECUTION_ONE_PAGER.md)（單一入口）。

---

## 六、本機開發啟動

1. `cd server` → `npm run dev`（`http://127.0.0.1:8080`）  
2. 另開終端 `cd server` → `npm run worker:dev`  
3. 專案根目錄 → `npm run dev`（前端）

新環境：`npm run db:push -- --skip-generate` → `npm run db:seed`（清欄位基線：`npm run db:seed:reset-fields`）。

健康檢查：`GET /api/health`

改碼後：`npm run typecheck`（根目錄）、`cd server && npm run build`。

---

## 七、附錄：其他文件怎麼用（不必重複讀）

| 檔案 | 內容 |
|------|------|
| `BACKLOG.md` | 可結案任務表（P0～P3 里程碑）；與本檔若有衝突，**以本檔 §二、§四 校正說明為準** |
| `LONG_TERM_SPEC.md` | **長期規格與持續演進**；**§6** 為前端示意頁規劃 |
| `FIELD_MANAGEMENT_REFACTOR.md` | **欄位管理**重構需求、與資料管理對齊、分階段驗收；右側 AI 側欄段落仍屬規劃 |
| `FIELD_PROMOTION_HANDOFF.md` | **欄位升級 / field-promotion** 最新交接、已完成內容、缺口與下一步 |
| `FIELD_PROMOTION_MIGRATION.md` | **`fp_*` DB 遷移與上線策略**：runtime DDL、正式 SQL／Prisma 收斂、順序、回滾、漂移 |
| **本檔 §十** | **前端模組接線狀態**（已接 API／示意 mock 一覽） |
| `DEFAULT_FIELD_PREFILL_LOGIC.md` | 匯入表頭對應與預設欄位行為 |
| `PHONE_COUNTRY_RULES_DRAFT.md` | 國家／電話驗證策略草案（與匯入、清理無效、後端 `isValidPhoneByCountry` 對照） |
| `QUERY_OPTIMIZATION_CHECKLIST.md` | 慢查詢／冷熱欄位優化檢核 |
| `P3_RUNBOOK.md`、`BACKUP_DRILL_RUNBOOK.md`、`FULL_SCALE_VALIDATION.md` | 上線／備份／整包驗收 |

**已自 `docs/` 移除（與本檔重複或過期）**：`HANDOFF_2026-04-13.md`、`HANDOFF_2026-04-14_CONTINUE.md`、`SCALING_NOTES.md`、`NEXT_SESSION_BRIEF.md`、`DATA_FIELD_MANAGEMENT_IMPLEMENTATION.md`。若需舊段落請查版本庫歷史。

---

## 八、給下一個 AI 視窗

請先讀 **`docs/CRM_MASTER_BRIEF.md`**；若任務涉及 DB 形狀（是否分區、是否有 backup），**務必請使用者執行 §二 SQL 或貼結果**，勿僅依口頭或過期敘述。

---

## 九、下一時窗實作規劃（建議順序）

目標：下一個對話一開就能照表施工，並有可驗收的完成線。**已結案項**以下表 ✅ 標示；新工作優先看 **時窗 E**（前端示意頁）或 **時窗 D**（維運）。

### 時窗 A — 使用者可感知、風險低

| 項目 | 狀態 | 驗收摘要 |
|------|------|----------|
| **A1. ExportModal 筆數與篩選 total 一致** | ✅ | 開啟匯出時重抓 `total`、載入中提示；`publishTaskCreated` 帶正確 `totalRows`。 |
| **A2. BACKLOG／長期規格分流** | ✅ | `LONG_TERM_SPEC.md` 承接「做不完」項；`BACKLOG.md` 可結案里程碑。 |

### 時窗 B — 體驗與穩定性

| 項目 | 狀態 | 驗收摘要 |
|------|------|----------|
| **B1. 任務 SSE 斷線** | ✅ | `subscribeUnifiedTasks`：重連 + `GET /api/jobs` fallback。 |
| **B2. 錯誤與 toast（第一階段）** | ✅ | `formatApiThrownError`：匯入／匯出／清理無效／合併欄位／Header／任務中心等；**其餘頁面**可續收斂。 |

### 時窗 C — 產品規格驅動

| 項目 | 狀態 | 說明 |
|------|------|------|
| **C1. 清理無效／國別規則** | 🟡 **第一版已落地** | `phoneCountryRules.ts` 已對齊草案多國；**誤判收斂／矩陣擴充** → `LONG_TERM_SPEC.md` §2。 |
| **C2. 合併欄位門檻** | ✅ **第一版** | 後端 `MERGE_FIELDS_*_RISK_THRESHOLD`（env）；預覽 `riskThresholds`；**管理後台設定表**屬長期。 |
| **C3. P2-2 分組 CRUD** | ✅ | API + `FieldManagementPage` 分組管理。 |

### 時窗 D — 維運／上線（非日常功能）

| 項目 | 做什麼 |
|------|--------|
| **D1. P3-5 備份演練** | UI 快照 + `npm run backup:pg-dump`（`LONG_TERM_SPEC.md` §4）；對齊 `BACKUP_DRILL_RUNBOOK.md`。 |
| **D2. staging／prod 分區 cutover** | 僅目標環境；事前 **§二 SQL** + `partition:drill`。 |

### 時窗 E — 前端示意／體驗頁接線（優先排期建議）

| 項目 | 現況 | 建議方向 |
|------|------|----------|
| **統計分析** `statistical-analysis` | `StatisticalAnalysisPage.tsx` 原為 **mock 數字／圖表占位** | 目前已自 UI 隱藏；待 KPI 與正式資料來源定案後再開 |
| **資料驗證** `data-validation` | `DataValidationPage.tsx` 原為 **mockValidationStats** | 目前已自 UI 隱藏；未來優先考慮整合至 `clean-invalid` 或分析報表 |
| **側欄系統狀態** | `Sidebar.tsx` 原為「資料行數：-」「存儲使用：-」占位 | 目前已移除占位；待有真實 summary API 再評估恢復 |

詳列與維護方式見 **§十**、**`LONG_TERM_SPEC.md` §6**。

### 下一個視窗建議開場白（可貼給 AI）

> 請讀 `docs/CRM_MASTER_BRIEF.md` **§十**（前端接線狀態）與 **`LONG_TERM_SPEC.md` §6**（示意頁規劃）。若要改示意頁，先確認是否已有對應 API；若需動 DB，貼 §二 SQL 結果。改碼後：`npm run typecheck`、`cd server && npm run build`。

---

## 十、前端模組與接線狀態（摘要）

> 路由切換見 `src/pages/Home.tsx`；側欄見 `src/components/layout/Sidebar.tsx`。

| 模組 ID | 頁面（主要檔案） | 接線狀態 |
|---------|------------------|----------|
| `data-management` | `DataManagementPage.tsx` | ✅ 主檔列表／篩選／工具接 API |
| `export-center` | `ExportCenterPage.tsx` | ✅ 匯出任務與下載 |
| `import-records` | `ImportRecordsPage.tsx` | ✅ 匯入紀錄 |
| `field-management` | `FieldManagementPage.tsx` | ✅ 欄位／分組 API |
| `invalid-quarantine` | `InvalidQuarantinePage.tsx` | ✅ 隔離列表 API |
| `task-center` | `TaskCenterPage.tsx`（多由 Header 進入） | ✅ 任務列表／SSE fallback |
| `audit-logs` | `AuditLogsPage.tsx` | ✅ 稽核（admin） |
| `backup-restore` | `BackupRestorePage.tsx` | ✅ 快照（admin） |
| `statistical-analysis` | `StatisticalAnalysisPage.tsx` | ⏸️ **已隱藏**：原為示意 mock 頁，待未來規劃 |
| `data-validation` | `DataValidationPage.tsx` | ⏸️ **已隱藏**：原為示意 mock 頁，待未來規劃 |

**備註**：`DataManagementPage` 初始欄位標籤來自 `mockData` 僅作 **掛載前預設**，載入後由 **欄位定義 API** 覆寫，不視為未接線。
