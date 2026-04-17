/// <reference types="node" />
import "dotenv/config";
import { spawnSync } from "node:child_process";

/**
 * 以 DATABASE_URL 呼叫本機 `pg_dump`，產出可攜 SQL（需已安裝 PostgreSQL client）。
 * 用法：`npm run backup:pg-dump -- [輸出檔路徑.sql]`（檔名可省略，將自動命名）
 */
const urlRaw = process.env.DATABASE_URL;
if (!urlRaw) {
  console.error("DATABASE_URL 未設定，無法執行 pg_dump。");
  process.exit(1);
}

let u: URL;
try {
  u = new URL(urlRaw);
} catch {
  console.error("DATABASE_URL 格式無法解析。");
  process.exit(1);
}

const pathPart = (u.pathname || "/").replace(/^\//, "");
const dbName = pathPart.split("/")[0]?.split("?")[0];
if (!dbName) {
  console.error("無法從 DATABASE_URL 取得資料庫名稱。");
  process.exit(1);
}

const outArg = process.argv[2];
const outfile =
  outArg ||
  `pgdump-${dbName}-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}Z.sql`;

const user = decodeURIComponent(u.username || "postgres");
const port = u.port || "5432";
const host = u.hostname;

const pwd = u.password ? decodeURIComponent(u.password) : "";
const env = { ...process.env, ...(pwd ? { PGPASSWORD: pwd } : {}) };

const args = ["-h", host, "-p", port, "-U", user, "-d", dbName, "-f", outfile, "--no-owner", "--no-acl"];

console.log(`Writing backup to ${outfile} ...`);
const r = spawnSync("pg_dump", args, { env, stdio: "inherit" });
if (r.error) {
  console.error(String(r.error.message || r.error));
  process.exit(1);
}
if (r.status !== 0 && r.status !== null) {
  process.exit(r.status);
}
console.log("Done.");
