# 企業資料管理系統 (Enterprise Data Management System)

一個基於 React + TypeScript + Tailwind CSS 的現代化企業資料管理系統，提供完整的資料管理、篩選、匯入匯出等功能。

## 相關文件

- **[資料管理與欄位管理 — 功能盤點與後端實作方案](docs/DATA_FIELD_MANAGEMENT_IMPLEMENTATION.md)**：從現有 UI 反查功能、建議 API／資料表與實作順序（MVP 對後端對接用）。
- **[補齊任務清單](docs/BACKLOG.md)**：按 P0～P3 與建議衝刺順序，對齊按鈕與業務流程。
- **[後端 API（MVP）](server/README.md)**：`docker compose`、Prisma、`npm run dev:api` 與已實作端點。

### 同時跑前端與後端

1. 依 `server/README.md` 啟動 PostgreSQL 並執行 `npx prisma db push` 與 `db seed`。
2. 終端機 A：`npm run dev:api`（埠 8080）
3. 終端機 B：`npm run dev`（埠 5173，會將 `/api` 代理到 8080）

## 技術棧

- **前端框架**: React 18
- **開發語言**: TypeScript
- **樣式框架**: Tailwind CSS
- **UI 組件**: shadcn/ui
- **圖標**: Lucide React
- **路由**: React Router DOM
- **構建工具**: Vite

## 功能特色

### 🎯 核心功能
- **資料管理**: 完整的 CRUD 操作
- **智能篩選**: 多條件篩選和搜索
- **分頁顯示**: 靈活的分頁控制
- **匯入匯出**: 支援多種格式的資料匯入匯出
- **通知系統**: 即時通知和狀態反饋

### 🎨 用戶界面
- **響應式設計**: 適配各種螢幕尺寸
- **深色模式**: 支援深色/淺色主題切換
- **側邊欄導航**: 可收縮的側邊欄設計
- **現代化 UI**: 基於 shadcn/ui 的美觀界面

### 📊 資料展示
- **表格視圖**: 清晰的資料表格展示
- **狀態指示**: 錯誤狀態和成功狀態的視覺反饋
- **操作按鈕**: 編輯、刪除等快捷操作
- **批量選擇**: 支援全選和批量操作

## 快速開始

### 安裝依賴
```bash
npm install
```

### 開發模式
```bash
npm run dev
```

### 構建生產版本
```bash
npm run build
```

### 預覽生產版本
```bash
npm run preview
```

### 代碼檢查
```bash
npm run lint
npm run typecheck
```

## 項目結構

```
src/
├── components/          # UI 組件
│   └── ui/             # shadcn/ui 組件
├── pages/              # 頁面組件
│   ├── Home.tsx        # 主頁面 (資料管理)
│   ├── Login.tsx       # 登入頁面
│   ├── Records.tsx     # 記錄頁面
│   └── Import.tsx      # 匯入頁面
├── lib/                # 工具函數
└── styles/             # 樣式文件
```

## 主要頁面

### 主頁面 (Home.tsx)
- 完整的資料管理界面
- 側邊欄導航系統
- 搜索和篩選功能
- 資料表格展示
- 分頁控制
- 狀態欄信息

### 功能模組
- **資料管理**: 核心資料操作
- **欄位管理**: 欄位配置和自定義
- **資料驗證**: 資料完整性檢查
- **匯出中心**: 資料匯出功能
- **匯入記錄**: 匯入歷史記錄
- **備份還原**: 資料備份和恢復
- **統計分析**: 資料統計和圖表
- **文檔中心**: 文檔管理

## 開發指南

### 添加新組件
1. 在 `src/components/` 目錄下創建新組件
2. 使用 TypeScript 和 Tailwind CSS
3. 遵循 shadcn/ui 的設計規範

### 添加新頁面
1. 在 `src/pages/` 目錄下創建新頁面
2. 在 `src/App.tsx` 中添加路由配置
3. 確保響應式設計和無障礙訪問

### 樣式指南
- 使用 Tailwind CSS 類名
- 遵循設計系統的顏色和間距
- 支援深色模式
- 確保響應式設計

## 瀏覽器支援

- Chrome (最新版本)
- Firefox (最新版本)
- Safari (最新版本)
- Edge (最新版本)

## 授權

MIT License

## 貢獻

歡迎提交 Issue 和 Pull Request！

---

**企業資料管理系統** - 讓資料管理更簡單、更高效
