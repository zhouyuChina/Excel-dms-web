/**
 * 一鍵打包啟動：build 前端 → 啟動 API → 自動開瀏覽器
 *   npm start            (預設 http://127.0.0.1:8080)
 *   PORT=3000 npm start  (自訂 port)
 */
import { execSync, spawn, exec } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const serverDir = path.join(root, "server");
const isWin = process.platform === "win32";
const port = process.env.PORT || "8080";
const url = `http://127.0.0.1:${port}`;

// ── 1. 打包前端 ──────────────────────────────────────────────
console.log("\n  [1/3] 打包前端 (vite build) ...\n");
execSync("npx vite build", { cwd: root, stdio: "inherit" });

if (!existsSync(path.join(root, "dist", "index.html"))) {
  console.error("\n  ✗ 前端打包失敗：找不到 dist/index.html\n");
  process.exit(1);
}
console.log("\n  ✓ 前端打包完成\n");

// ── 2. 啟動 API server（用 tsx 免編譯）─────────────────────
console.log("  [2/3] 啟動 API server ...\n");
const tsxBin = path.join(serverDir, "node_modules", ".bin", isWin ? "tsx.cmd" : "tsx");
const server = spawn(tsxBin, ["src/index.ts"], {
  cwd: serverDir,
  stdio: "inherit",
  env: { ...process.env, PORT: port },
  ...(isWin ? { shell: "cmd.exe" } : {}),
});

// ── 3. 等 server 就緒，開瀏覽器 ─────────────────────────────
async function waitAndOpen() {
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) {
        console.log(`\n  [3/3] 開啟瀏覽器 ${url}\n`);
        if (isWin) exec(`start "" "${url}"`);
        else if (process.platform === "darwin") exec(`open "${url}"`);
        else exec(`xdg-open "${url}"`);
        return;
      }
    } catch { /* server not ready yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(`\n  ⚠ 等待超時，請手動開啟 ${url}\n`);
}

waitAndOpen();

// ── cleanup ──────────────────────────────────────────────────
function cleanup() {
  server.kill();
  process.exit(0);
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
server.on("close", (code) => process.exit(code ?? 0));
