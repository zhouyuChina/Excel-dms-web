# DMS API（MVP）

Node.js + Express + Prisma + PostgreSQL。

## 本機啟動

1. 安裝並啟動 PostgreSQL（建議 Docker）：

   ```bash
   cd ..
   docker compose up -d
   ```

2. 設定環境變數（可複製 `.env.example` 為 `.env`）：

   ```
   DATABASE_URL="postgresql://dms:dms@127.0.0.1:5432/dms?schema=public"
   PORT=8080
   ```

3. 建立資料表並種子資料：

   ```bash
   cd server
   npm install
   npx prisma db push
   npx prisma db seed
   ```

4. 啟動 API：

   ```bash
   npm run dev
   ```

   預設 `http://127.0.0.1:8080`；前端 Vite 已將 `/api` 代理至此埠。

## 已實作端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/health` | 服務與 DB 連線 |
| GET | `/api/footer` | Footer 顯示用 |
| GET | `/api/customers/meta` | 國家、提供者去重列表 |
| GET | `/api/customers` | 分頁列表（`q`、`exportStatus`、`sortField`、`sortDir`、`filters`） |
| GET | `/api/field-definitions` | 欄位定義（供資料管理欄位標籤） |

## 客戶識別（國家 + 電話）

- **唯一性**：`country` + `phoneNormalized`（電話僅數字）。
- **CUID**：由「國家 + 電話」雜湊衍生；同一號碼在不同國家為不同客戶。
- **`phone`**：可存顯示格式（`+886 912…`、括號、空格等）。

## 後續

匯入 Job、工具選單批次操作、匯出與紅點、稽核／復原等見 `docs/DATA_FIELD_MANAGEMENT_IMPLEMENTATION.md`。

### Schema 變更後

若已跑過舊版 `db push`，變更欄位後請在 `server` 目錄執行 `npx prisma db push`，再 `npx prisma db seed`（種子會清空並重建客戶示範資料）。
