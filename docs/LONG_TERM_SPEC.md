# 長期規格與持續演進

> **用途**：收納**不預期在單一衝刺結案**、會隨產品／資料／維運演進反覆調整的能力與決策。  
> **與 [`BACKLOG.md`](./BACKLOG.md) 分工**：`BACKLOG.md` 以 **P0～P3 可勾選里程碑**為主；本檔描述「第一版已上線後仍會持續發生」的規格與方向，避免 backlog **永遠顯示未完成**。

**最後更新**：2026-04-16

---

## 1. 為什麼需要這份文件

- 某些能力（例如**國別電話規則**、**清理無效**誤判收斂）本質上是**持續優化**，不適合用「⬜ 未完成」永久佔用 backlog。
- **維運專屬工作**（staging／prod 分區 cutover、備份演練頻率）依窗口執行，不應與日常功能開發混在同一張「做完沒」表。
- 決策點與草案（例如 [`PHONE_COUNTRY_RULES_DRAFT.md`](./PHONE_COUNTRY_RULES_DRAFT.md) §4）在此**集中索引**，需要拍板時再開議題或拆成短期 ticket。

---

## 2. 資料品質與清理無效（持續演進）

| 方向 | 說明 | 關聯 |
|------|------|------|
| 國別／電話規則 | 依真實資料樣本收斂 regex、市話／邊界案例；草案決策見 `PHONE_COUNTRY_RULES_DRAFT.md` | `server/src/lib/phoneCountryRules.ts` |
| Email 驗證 | 現行清理為極簡 pattern；若要對齊 RFC／國際網域，屬獨立優化 | `clean-invalid` 規則 `email_invalid` |
| 預覽與隔離策略 | 維持「預覽 → 任務 → 隔離審核」；若產品要更細理由碼／批次復原，再拆需求 | `CleanInvalidModal`、隔離頁 |

**備註**：P1-5「清理無效」在 `BACKLOG.md` 以 **✅ 第一版已完成** 結案；上列為**長期規格演進**，不影響第一版驗收。

---

## 3. 工具模組第二版（體驗／稽核／可回復）

| 方向 | 說明 |
|------|------|
| 合併欄位／清理無效 | 更多預覽指標、操作稽核串接、可回復流程（若產品要與快照／稽核 deep link） |
| **欄位管理** | 與 **資料管理** 體驗對齊、分階段重構 → [`FIELD_MANAGEMENT_REFACTOR.md`](./FIELD_MANAGEMENT_REFACTOR.md)（Phase B/C 仍待排） |
| 錯誤與 toast | 全站收斂為同一套解析／文案（`BACKLOG` 已列第一階段完成者除外） |

---

## 4. 效能、億級與維運（非日常功能）

| 方向 | 說明 | 關聯 |
|------|------|------|
| 分區正式 cutover | staging／prod、rename-swap 彩排、回滾驗證、上線窗口 | `partition-cutover.sql`、`partition:drill`、`P3_RUNBOOK.md` |
| 備份還原 | UI 快照 + 可攜 `pg_dump` 並行演練；頻率與離線保存見 runbook | `BACKUP_DRILL_RUNBOOK.md`、`npm run backup:pg-dump` |
| 查詢與索引 | 依業務回報與慢查調整冷熱欄位 | `QUERY_OPTIMIZATION_CHECKLIST.md` |

---

## 5. 可選技術強化（不阻塞產品里程碑）

- 任務 SSE：**heartbeat**、**metrics**、監控告警（現已有斷線重連 + `GET /api/jobs` fallback）。
- 其他觀測與調參：依上線後負載再開。

---

## 6. 前端示意頁與體驗補強（規劃）

以下側欄模組**仍為示意 UI 或占位**，使用者可能誤以為是真實營運數字；**單一真相**仍以 **`CRM_MASTER_BRIEF.md` §十** 為準。

| 優先序（建議） | 模組 | 檔案 | 現況 | 可選方向 |
|----------------|------|------|------|----------|
| 1 | 統計分析 | `StatisticalAnalysisPage.tsx` | `mockStats`、`mockFieldUsage` 等 | 定義 KPI → 後端聚合 API（或暫時隱藏選單／加「示意」角標） |
| 2 | 資料驗證 | `DataValidationPage.tsx` | `mockValidationStats` | 與主檔／清理無效規則對齊之報表 API；或簡化為導流至「資料管理」 |
| 3 | 側欄系統狀態 | `Sidebar.tsx` | 「資料行數：-」「存儲使用：-」 | `/api/health` 或統計 API；或改為摺疊／移除 |

**驗收建議**：任一路線上線前，至少 **明確標示「示意」** 或 **不接 API 則不顯示該模組**（避免誤導）。

---

## 7. 文件索引（長期規格常一起讀）

| 檔案 | 用途 |
|------|------|
| [`CRM_MASTER_BRIEF.md`](./CRM_MASTER_BRIEF.md) | 專案總覽、DB 事實對齊、**§十 前端接線狀態** |
| [`PHONE_COUNTRY_RULES_DRAFT.md`](./PHONE_COUNTRY_RULES_DRAFT.md) | 國別電話草案與程式對照 |
| [`P3_RUNBOOK.md`](./P3_RUNBOOK.md)、[`BACKUP_DRILL_RUNBOOK.md`](./BACKUP_DRILL_RUNBOOK.md) | 上線與備份演練 |
| [`QUERY_OPTIMIZATION_CHECKLIST.md`](./QUERY_OPTIMIZATION_CHECKLIST.md) | 查詢優化檢核 |

---

## 8. 維護方式

- **短期可驗收項**（例如某一支 API、某一頁接線）：仍應落在 **`BACKLOG.md`** 或 issue，方便結案。
- **「永遠可以更好」的敘述**：新增或調整於**本檔**，並在 `BACKLOG.md` 用一行指向本檔即可。
