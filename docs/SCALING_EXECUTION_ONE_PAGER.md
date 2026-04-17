# 億級演進執行單頁（唯一入口）

> 只看這份就能判斷：目前環境屬於「單表基線」還是「可進入 cutover」。

## 1) 先做現況判斷（必做）

在目標 `DATABASE_URL` 執行：

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

### 1.1 Windows PowerShell：怎麼跑這段 SQL？

**不要**把 Markdown 的 ` ```sql ` / ` ``` ` 或整段 SQL 直接貼進 PowerShell 提示字元；PowerShell 會把 `FROM`、`JOIN` 等當成指令而報錯。請用 `psql` 執行（本機已安裝 PostgreSQL 客戶端時）。

連線字串建議用 **`host:port/dbname`**，不要帶 Prisma 常用的 `?schema=public`（`psql` 可能無法解析）。

**一行版（複製即可）：**

```powershell
$env:PGURL = "postgresql://dms:dms@127.0.0.1:5432/dms"
psql $env:PGURL -c "SELECT c.relname::text AS name, CASE c.relkind WHEN 'r' THEN 'ordinary' WHEN 'p' THEN 'partitioned_parent' ELSE c.relkind::text END AS kind, pg_get_partkeydef(c.oid) AS partition_key FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname ILIKE '%customer%' AND c.relkind IN ('r','p') ORDER BY 1;"
```

**多行版（可讀性較好）：**

```powershell
$env:PGURL = "postgresql://dms:dms@127.0.0.1:5432/dms"
$sql = @'
SELECT c.relname::text AS name,
       CASE c.relkind WHEN 'r' THEN 'ordinary' WHEN 'p' THEN 'partitioned_parent' ELSE c.relkind::text END AS kind,
       pg_get_partkeydef(c.oid) AS partition_key
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname ILIKE '%customer%'
  AND c.relkind IN ('r','p')
ORDER BY 1;
'@
$sql | psql $env:PGURL
```

判讀：
- `Customer = r`：單表基線，尚未完成分區切換。
- `Customer = p`：已是分區主表。

## 2) 選擇執行路徑（只選一條）

- **開發環境（測試資料可重建）**：重建式升級  
  不做資料搬遷，直接重建 `Customer` 分區主表，再重灌 seed 驗證。

- **正式環境（業務資料不可丟）**：遷移式 cutover  
  影子表 + backfill + rename-swap + rollback。

### 2.1 合成大量 Customer（壓測用，不必手動匯入）

以 Prisma 分批寫入；`provider = __bulk_seed__` 可整批清除。

```bash
cd server
# 查看分段筆數（tier 1～7）
npm run db:bulk-customers -- --list-tiers

# 依層級灌入（例：tier 3 = 20 萬筆）；升級建議加大 --offset 避免電話序號與上一輪重疊
npm run db:bulk-customers -- --wipe --tier=2 --batch=3000
npm run db:bulk-customers -- --tier=3 --batch=5000 --offset=200000000

# 自訂筆數（仍可用）
npm run db:bulk-customers -- --count=100000 --batch=2000
# 只看一筆長相、不寫庫
npm run db:bulk-customers -- --count=1 --dry-run
```

灌完再跑：`npm run perf:loadtest`（需本機 API 已啟在 `LOADTEST_API_BASE`，預設 `http://127.0.0.1:8080`）。

**型別檢查**：`server/tsconfig.json` 預設只含 `src/`；`scripts/` 與 `prisma/seed.ts` 請用 `cd server && npm run typecheck`（會跑 `tsconfig.tools.json`）。

## 3) Drill 指令（統一用法）

```bash
cd server
npm run partition:drill -- --mode=backfill
npm run partition:drill -- --mode=rollback
```

說明：
- `backfill`：會自動檢查 `Customer_v2` 或 `customer_p`；若都不存在，回報「單表基線」而非報錯中止。
- `rollback`：回報 active/shadow/backup 表是否存在，作為回滾可行性檢查。

## 4) 本次目標驗收（最小集）

- [ ] 查詢形態正確（`Customer` 是預期的 `r` 或 `p`）。
- [ ] 任務中心與主流程 smoke test 可通（列表/匯入/任務完成回寫）。
- [ ] 若走分區路徑，drill 結果可解讀且回滾路徑明確。

## 5) 常見誤解（避免重複踩坑）

- 文件提到 cutover/影子表，不代表當前環境一定存在。
- 曾做過 local 演練，不代表目前 DB 仍處於分區狀態。
- 判斷一律以 SQL 現況為準，不以口頭或舊紀錄為準。
