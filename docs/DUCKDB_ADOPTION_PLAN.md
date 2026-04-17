# DuckDB 導入規劃

本文定義本專案若引入 DuckDB，應承接哪些工作、哪些工作不該交給它，以及建議的導入順序。

## 1. 核心結論

DuckDB 在本專案中的定位應是 **分析側車（analytical sidecar）**，不是資料管理頁主列表的即時資料來源。

也就是：

- PostgreSQL：主交易路徑、單筆編輯、備註、日常篩選與搜尋
- DuckDB：重掃描、重聚合、重驗證、批次報表

## 2. 不建議交給 DuckDB 的工作

下列工作不應由 DuckDB 承接：

- 資料管理頁主列表
- 即時搜尋與即時篩選
- 單筆編輯
- 添加備註
- 欄位管理 CRUD
- 即時匯入後立刻查詢

原因：

- 這些都屬於主交易路徑
- 需要一致性、即時性與權限控制
- 若改由 DuckDB 承接，會導致同步、資料新鮮度與寫回複雜度快速上升

## 3. 第一優先：清理無效預覽

### 為什麼最適合先做

- 讀多寫少
- 規則型檢查
- 容易自主列表切出去
- 風險低
- 成果明顯

### 建議工作分工

- PostgreSQL：
  - 儲存正式資料
  - 依清理名單做隔離或刪除
  - 管理 job 狀態
- DuckDB：
  - 掃描候選資料
  - 執行規則驗證
  - 輸出統計、樣本與待清理名單

### 第一版輸出

- 總掃描筆數
- 各規則命中數
- 各 provider / country 的命中分佈
- 可下載的樣本報告
- 待清理名單摘要

## 4. 第二優先：promotion validation

### 為什麼要第二個做

- 已在做 `field-promotion`
- 未來固定欄位升級一定需要驗證與比對
- 非主交易路徑
- 與目前 roadmap 直接相連

### 建議工作分工

- PostgreSQL：
  - 寫入固定欄位
  - 保留 promotion job / metadata / apply 狀態
- DuckDB：
  - 比對 promotion 前後資料
  - 統計 mismatch / null fill / success rate
  - 產出 validation report

### 第一版輸出

- source non-null count
- target non-null count
- mismatch count
- sample mismatch rows
- 可供維護判斷是否清理舊值的驗證報告

## 5. 後續候選場景

待第一、二優先穩定後，再考慮：

- 統計分析報表
- 資料驗證報表
- 大型匯出前資料整形
- 長時間聚合分析

## 6. 建議導入方式

### Phase A

先以離線 job / script / worker 方式導入，不進主 API 熱路徑。

### Phase B

把 DuckDB 輸出收斂為：

- job result
- summary table
- downloadable report

### Phase C

若效果明顯，再考慮把更多分析型頁面改讀這些結果，而不是直接掃主庫。

## 7. 一句話結論

DuckDB 值得導入，但應先做：

1. 清理無效預覽
2. promotion validation

而不是先接到資料管理頁主列表。
