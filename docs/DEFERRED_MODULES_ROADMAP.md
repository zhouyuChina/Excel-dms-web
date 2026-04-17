# 暫緩模組規劃

本文記錄目前已從主 UI 隱藏、暫不對外開放的模組與占位區塊，避免 mock 頁面被誤認為正式功能。

## 1. 已隱藏項目

### `statistical-analysis`

- 原檔案：`src/components/business/statistics/StatisticalAnalysisPage.tsx`
- 先前狀態：mock 數字、圖表與占位分析
- 目前處理：已自側欄與主路由隱藏，頁面內容已清空為 defer stub
- 未來方向：
  - 待定 KPI
  - 待定聚合 API
  - 待評估是否由 DuckDB / 分析側車承接

### `data-validation`

- 原檔案：`src/components/business/validation/DataValidationPage.tsx`
- 先前狀態：mock validation stats 與假按鈕流程
- 目前處理：已自側欄、工具選單與主路由隱藏，頁面內容已清空為 defer stub
- 未來方向：
  - 優先與 `clean-invalid` 路徑整合
  - 若需要獨立報表，再評估用 PostgreSQL summary 或 DuckDB 分析結果承接

### 側欄系統狀態占位

- 原檔案：`src/components/layout/Sidebar.tsx`
- 先前狀態：顯示 `資料行數：-`、`存儲使用：-`
- 目前處理：已移除占位顯示
- 未來方向：
  - 若有真實需求，再接 `/api/health`、summary API 或背景快取結果

## 2. 為什麼先隱藏

目前隱藏的原因不是功能永遠不做，而是：

- 尚未接正式 API
- 尚未定義穩定資料來源
- 若保留在 UI，容易讓使用者誤以為可正式使用
- 當前優先順序應先放在主交易路徑與欄位升級治理

## 3. 未來開啟條件

只有在同時滿足下列條件時，才建議重新開啟：

1. 有正式資料來源
2. 有明確產品用途
3. 不會拖慢主列表與主交易路徑
4. 已定義驗收方式與維護責任

## 4. 與 DuckDB 的關係

若未來導入 DuckDB，最可能重新打開的會是：

- `statistical-analysis`
- `data-validation`

但前提仍是：

- 先完成 `clean-invalid` 預覽與 `promotion validation` 的分析側車設計
- 再把成熟結果轉成可讀頁面，而不是先做 UI 再補資料
