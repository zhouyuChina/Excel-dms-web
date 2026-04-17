/**
 * CRM 可攜版打包腳本（Windows 免安裝）
 *
 * 使用方式：  node scripts/bundle-portable.mjs
 * 跳過下載：  node scripts/bundle-portable.mjs --skip-download
 * 跳過 DB：   node scripts/bundle-portable.mjs --skip-db
 *
 * 產出：build/CRM/  （壓成 zip 給對方即可）
 */
import { execSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  cpSync,
  writeFileSync,
  rmSync,
  readdirSync,
  renameSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SERVER = path.join(ROOT, "server");
const VENDOR = path.join(ROOT, "vendor");
const outputArg = process.argv.find((a) => a.startsWith("--output="));
const OUTPUT = outputArg
  ? path.resolve(outputArg.split("=")[1])
  : path.join(ROOT, "build", "CRM");

// ── 版本設定（可按需更新）────────────────────────────────
const NODE_VERSION = "20.20.2";
const NODE_ZIPNAME = `node-v${NODE_VERSION}-win-x64.zip`;
const NODE_URL = `https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ZIPNAME}`;
const NODE_EXTRACT_DIR = `node-v${NODE_VERSION}-win-x64`;

const PG_VERSION = "16.8-1";
const PG_ZIPNAME = `postgresql-${PG_VERSION}-windows-x64-binaries.zip`;
const PG_URL = `https://get.enterprisedb.com/postgresql/${PG_ZIPNAME}`;

// ── 參數 ─────────────────────────────────────────────────
const args = process.argv.slice(2);
const skipDownload = args.includes("--skip-download");
const skipDb = args.includes("--skip-db");

function step(n, total, msg) {
  console.log(`\n  [${n}/${total}] ${msg}\n`);
}

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: "inherit", ...opts });
}

function tryRun(cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: "pipe", ...opts });
    return true;
  } catch {
    return false;
  }
}

function download(url, dest) {
  console.log(`    下載 ${path.basename(dest)} ...`);
  console.log(`    URL: ${url}`);
  const r = spawnSync("curl", ["-L", "--progress-bar", "-o", dest, url], {
    stdio: "inherit",
    shell: true,
  });
  if (r.status !== 0) {
    console.error(`    ✗ 下載失敗。請手動下載並放到：${dest}`);
    return false;
  }
  if (!existsSync(dest) || statSync(dest).size < 1024) {
    console.error(`    ✗ 檔案無效。請手動下載：${url}`);
    if (existsSync(dest)) rmSync(dest);
    return false;
  }
  console.log(`    ✓ 下載完成`);
  return true;
}

function extract(zipPath, destDir) {
  console.log(`    解壓 ${path.basename(zipPath)} ...`);
  mkdirSync(destDir, { recursive: true });
  run(`tar -xf "${zipPath}" -C "${destDir}"`, { stdio: "pipe" });
  console.log(`    ✓ 解壓完成`);
}

const TOTAL_STEPS = skipDb ? 6 : 7;
let currentStep = 0;

// ═══════════════════════════════════════════════════════════
// 1. 下載 vendor 依賴
// ═══════════════════════════════════════════════════════════
step(++currentStep, TOTAL_STEPS, "檢查 vendor 依賴 (Node.js + PostgreSQL)");

mkdirSync(VENDOR, { recursive: true });

const nodeZip = path.join(VENDOR, NODE_ZIPNAME);
const pgZip = path.join(VENDOR, PG_ZIPNAME);

if (!skipDownload) {
  if (!existsSync(nodeZip)) {
    if (!download(NODE_URL, nodeZip)) {
      console.error(`\n  請手動下載 Node.js 免安裝版：`);
      console.error(`    ${NODE_URL}`);
      console.error(`    放到：${nodeZip}\n`);
      process.exit(1);
    }
  } else {
    console.log(`    ✓ Node.js zip 已存在`);
  }

  if (!existsSync(pgZip)) {
    if (!download(PG_URL, pgZip)) {
      console.error(`\n  請手動下載 PostgreSQL 免安裝版：`);
      console.error(`    ${PG_URL}`);
      console.error(`    放到：${pgZip}\n`);
      process.exit(1);
    }
  } else {
    console.log(`    ✓ PostgreSQL zip 已存在`);
  }
} else {
  if (!existsSync(nodeZip) || !existsSync(pgZip)) {
    console.error(`    ✗ --skip-download 但 vendor zip 不存在`);
    process.exit(1);
  }
  console.log(`    ✓ 跳過下載（使用既有 vendor）`);
}

// ═══════════════════════════════════════════════════════════
// 2. 打包前端
// ═══════════════════════════════════════════════════════════
step(++currentStep, TOTAL_STEPS, "打包前端 (vite build)");
run("npx vite build", { cwd: ROOT });

if (!existsSync(path.join(ROOT, "dist", "index.html"))) {
  console.error("    ✗ 前端打包失敗");
  process.exit(1);
}
console.log("    ✓ 前端打包完成");

// ═══════════════════════════════════════════════════════════
// 3. 編譯後端
// ═══════════════════════════════════════════════════════════
step(++currentStep, TOTAL_STEPS, "編譯後端 (tsc)");
run("npx tsc", { cwd: SERVER });
console.log("    ✓ 後端編譯完成");

// ═══════════════════════════════════════════════════════════
// 4. 匯出資料庫（可選）
// ═══════════════════════════════════════════════════════════
const dumpFile = path.join(ROOT, "build", "dump.backup");
if (!skipDb) {
  step(++currentStep, TOTAL_STEPS, "匯出資料庫");
  let dumped = false;

  // 嘗試 Docker
  if (
    tryRun('docker exec dms-postgres pg_dump -U dms -Fc dms > NUL 2>&1', {
      shell: true,
    })
  ) {
    console.log("    使用 Docker 容器匯出...");
    run(`docker exec dms-postgres pg_dump -U dms -Fc dms > "${dumpFile}"`, {
      shell: true,
    });
    dumped = existsSync(dumpFile) && statSync(dumpFile).size > 100;
  }

  // 嘗試本機 pg_dump
  if (!dumped && tryRun("pg_dump --version")) {
    console.log("    使用本機 pg_dump 匯出...");
    tryRun(
      `pg_dump -h 127.0.0.1 -p 5432 -U dms -Fc dms -f "${dumpFile}"`,
      { shell: true }
    );
    dumped = existsSync(dumpFile) && statSync(dumpFile).size > 100;
  }

  if (dumped) {
    const sizeMb = (statSync(dumpFile).size / 1024 / 1024).toFixed(1);
    console.log(`    ✓ 匯出完成（${sizeMb} MB）`);
  } else {
    console.log("    ⚠ 無法匯出資料庫（Docker 未啟動或 pg_dump 不可用）");
    console.log("    可攜版將以空資料庫啟動");
  }
}

// ═══════════════════════════════════════════════════════════
// 5. 組裝輸出資料夾
// ═══════════════════════════════════════════════════════════
step(++currentStep, TOTAL_STEPS, "組裝 CRM 可攜資料夾");

if (existsSync(OUTPUT)) {
  console.log("    清除舊的 build/CRM ...");
  try {
    rmSync(OUTPUT, { recursive: true, force: true });
  } catch {
    console.log("    ⚠ 舊目錄被佔用（可能有殘留的 postgres 進程），請重開機後再試");
    console.log("    或手動刪除 build/CRM 資料夾");
    process.exit(1);
  }
}
mkdirSync(OUTPUT, { recursive: true });

// 5a. Node.js
console.log("    [node] 解壓 Node.js ...");
const nodeTmp = path.join(VENDOR, "_node_tmp");
if (existsSync(nodeTmp)) rmSync(nodeTmp, { recursive: true, force: true });
extract(nodeZip, nodeTmp);
const nodeExtracted = path.join(nodeTmp, NODE_EXTRACT_DIR);
const nodeDest = path.join(OUTPUT, "node");
if (existsSync(nodeExtracted)) {
  renameSync(nodeExtracted, nodeDest);
} else {
  // zip 可能直接解壓到 _node_tmp 下
  const entries = readdirSync(nodeTmp);
  const sub = entries.find((e) => e.startsWith("node-"));
  if (sub) renameSync(path.join(nodeTmp, sub), nodeDest);
  else renameSync(nodeTmp, nodeDest);
}
rmSync(nodeTmp, { recursive: true, force: true });
console.log("    [node] ✓");

// 5b. PostgreSQL（只保留 bin/ 和 lib/，跳過 pgAdmin 等大型元件）
console.log("    [pgsql] 解壓 PostgreSQL（僅 bin + lib）...");
const pgTmp = path.join(VENDOR, "_pg_tmp");
if (existsSync(pgTmp)) rmSync(pgTmp, { recursive: true, force: true });
extract(pgZip, pgTmp);
let pgSrcRoot = path.join(pgTmp, "pgsql");
if (!existsSync(pgSrcRoot)) {
  const entries = readdirSync(pgTmp);
  const sub = entries.find((e) => e.toLowerCase().includes("pgsql") || e.toLowerCase().includes("postgres"));
  if (sub) pgSrcRoot = path.join(pgTmp, sub);
  else { console.error("    ✗ 無法找到 PostgreSQL 目錄"); process.exit(1); }
}
const pgDest = path.join(OUTPUT, "pgsql");
mkdirSync(pgDest, { recursive: true });
for (const keep of ["bin", "lib", "share"]) {
  const src = path.join(pgSrcRoot, keep);
  if (existsSync(src)) {
    cpSync(src, path.join(pgDest, keep), { recursive: true });
  }
}
rmSync(pgTmp, { recursive: true, force: true });
console.log("    [pgsql] ✓");

// 5c. 前端 dist
console.log("    [dist] 複製前端...");
cpSync(path.join(ROOT, "dist"), path.join(OUTPUT, "dist"), { recursive: true });
console.log("    [dist] ✓");

// 5d. 後端
console.log("    [server] 複製後端編譯檔...");
const serverOut = path.join(OUTPUT, "server");
mkdirSync(path.join(serverOut, "dist"), { recursive: true });
cpSync(path.join(SERVER, "dist"), path.join(serverOut, "dist"), {
  recursive: true,
});

console.log("    [server] 複製 node_modules（需要幾分鐘）...");
cpSync(
  path.join(SERVER, "node_modules"),
  path.join(serverOut, "node_modules"),
  { recursive: true }
);

// 清除不需要的 devDep / 快取，節省空間
const nmClean = [".cache", "typescript", "@types", "@esbuild"];
for (const d of nmClean) {
  const p = path.join(serverOut, "node_modules", d);
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    console.log(`      清除 node_modules/${d}`);
  }
}

console.log("    [server] 複製 prisma schema...");
mkdirSync(path.join(serverOut, "prisma"), { recursive: true });
cpSync(
  path.join(SERVER, "prisma", "schema.prisma"),
  path.join(serverOut, "prisma", "schema.prisma")
);

// 5e. 環境設定
console.log("    [env] 產生 .env ...");
writeFileSync(
  path.join(serverOut, ".env"),
  [
    `DATABASE_URL=postgresql://dms@127.0.0.1:5433/dms?schema=public`,
    `PORT=8080`,
    "",
  ].join("\n"),
  "utf8"
);
console.log("    [server] ✓");

// 5f. 資料庫 dump
if (existsSync(dumpFile) && statSync(dumpFile).size > 100) {
  console.log("    [db] 複製資料庫備份...");
  cpSync(dumpFile, path.join(OUTPUT, "dump.backup"));
  console.log("    [db] ✓");
}

// 5g. 啟動/關閉腳本
console.log("    [bat] 複製啟動腳本...");
const batSrc = path.join(ROOT, "scripts", "portable");
cpSync(
  path.join(batSrc, "start-crm.bat"),
  path.join(OUTPUT, "啟動CRM.bat")
);
cpSync(
  path.join(batSrc, "stop-crm.bat"),
  path.join(OUTPUT, "關閉CRM.bat")
);
console.log("    [bat] ✓");

// 5h. VC++ Runtime 安裝程式
const vcRedist = path.join(VENDOR, "vc_redist.x64.exe");
if (existsSync(vcRedist)) {
  console.log("    [vcrt] 複製 VC++ Runtime 安裝程式...");
  cpSync(vcRedist, path.join(OUTPUT, "vc_redist.x64.exe"));
  console.log("    [vcrt] ✓");
}

// 5i. pgdata 空目錄（首次啟動會初始化）
mkdirSync(path.join(OUTPUT, "pgdata"), { recursive: true });

// ═══════════════════════════════════════════════════════════
// 6. 統計
// ═══════════════════════════════════════════════════════════
step(++currentStep, TOTAL_STEPS, "打包完成！");

function dirSize(dir) {
  let total = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) total += dirSize(full);
      else total += statSync(full).size;
    }
  } catch { /* skip */ }
  return total;
}

const totalBytes = dirSize(OUTPUT);
const totalMb = (totalBytes / 1024 / 1024).toFixed(0);

console.log(`    輸出目錄：${OUTPUT}`);
console.log(`    總大小：約 ${totalMb} MB`);
console.log();
console.log(`    交付方式：`);
console.log(`    1. 將 build/CRM 資料夾壓縮成 zip`);
console.log(`    2. 傳給對方解壓縮`);
console.log(`    3. 對方雙擊「啟動CRM.bat」即可使用`);

// ═══════════════════════════════════════════════════════════
// 7. 自動壓縮（可選）
// ═══════════════════════════════════════════════════════════
step(++currentStep, TOTAL_STEPS, "壓縮成 zip");

const zipOut = path.join(ROOT, "build", "CRM.zip");
if (existsSync(zipOut)) rmSync(zipOut);

try {
  run(
    `powershell -NoProfile -Command "Compress-Archive -Path '${OUTPUT}\\*' -DestinationPath '${zipOut}' -Force"`,
    { stdio: "pipe" }
  );
  if (existsSync(zipOut)) {
    const zipMb = (statSync(zipOut).size / 1024 / 1024).toFixed(0);
    console.log(`    ✓ ${zipOut}`);
    console.log(`    壓縮後大小：約 ${zipMb} MB`);
  }
} catch {
  console.log(`    ⚠ 自動壓縮失敗，請手動壓縮 build/CRM 資料夾`);
}

console.log(`\n  ✓ 全部完成！\n`);
