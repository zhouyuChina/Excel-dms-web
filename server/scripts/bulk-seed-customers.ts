/// <reference types="node" />
/**
 * 大量合成 Customer（壓測／億級演練用）
 *
 * 用法（在 server 目錄）：
 *   npx tsx scripts/bulk-seed-customers.ts --tier=3 --batch=3000
 *   npx tsx scripts/bulk-seed-customers.ts --count=100000 --batch=2000
 *   npx tsx scripts/bulk-seed-customers.ts --wipe --tier=4        # 先刪再灌
 *   npx tsx scripts/bulk-seed-customers.ts --list-tiers
 *
 * 分段（--tier）：由小到大壓測；若同時傳 --count= 則以 --count 為準。
 *
 * 環境變數（可選）：
 *   BULK_SEED_COUNT   預設筆數（若未傳 --count / --tier）
 *   BULK_SEED_BATCH     每批筆數
 *   BULK_SEED_OFFSET    電話序號起點（避免與既有資料撞 unique；換 tier 建議加大 offset）
 *
 * 合成列以 provider = "__bulk_seed__" 標記，可用 --wipe 整批刪除。
 */
import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";
import { cuidFromCountryPhone, normalizePhoneDigits } from "../src/lib/cuid.js";

const BULK_PROVIDER = "__bulk_seed__";

/** 分段筆數（可依磁碟再調整；tier 愈大建議愈謹慎） */
const TIER_PRESETS: Record<number, { count: number; hint: string }> = {
  1: { count: 5_000, hint: "煙霧／與 loadtest 同量級" },
  2: { count: 50_000, hint: "小量回歸" },
  3: { count: 200_000, hint: "中量列表／篩選" },
  4: { count: 1_000_000, hint: "百萬級" },
  5: { count: 5_000_000, hint: "五百萬級（注意磁碟）" },
  6: { count: 20_000_000, hint: "千萬～兩千萬級（建議專用測試庫）" },
  7: { count: 100_000_000, hint: "一億級目標（需足夠磁碟與時間）" },
};

function parseArg(prefix: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return fallback;
  const v = hit.slice(prefix.length);
  return v || fallback;
}

function parseIntArg(prefix: string, fallback: number, min: number, max: number): number {
  const raw = parseArg(prefix, String(fallback));
  const n = Number.parseInt(String(raw).replace(/_/g, ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function hasArgPrefix(prefix: string): boolean {
  return process.argv.some((a) => a.startsWith(prefix));
}

function resolveTargetCount(): number {
  if (hasArgPrefix("--count=")) {
    return parseIntArg("--count=", 10_000, 1, 200_000_000);
  }
  const tierRaw = parseArg("--tier=", "").trim();
  if (tierRaw) {
    const tier = Number.parseInt(tierRaw, 10);
    const preset = TIER_PRESETS[tier];
    if (!preset) {
      console.error(`[bulk-seed] 無效的 --tier=${tierRaw}（有效: 1～7）。執行 --list-tiers 查看說明。`);
      process.exit(1);
    }
    return preset.count;
  }
  return parseIntArg(
    "--count=",
    Number(process.env.BULK_SEED_COUNT || "10000"),
    1,
    200_000_000
  );
}

function printListTiers(): void {
  console.log("[bulk-seed] 分段（--tier=N），筆數與建議：");
  for (let t = 1; t <= 7; t += 1) {
    const p = TIER_PRESETS[t];
    console.log(`  tier ${t}: ${p.count.toLocaleString()} 筆 — ${p.hint}`);
  }
  console.log("");
  console.log("範例：npm run db:bulk-customers -- --wipe --tier=3 --batch=3000");
  console.log("建議：每升一級可加大 --offset=（例如 tier4 用 --offset=400000000）避免與上一級電話序號重疊。");
}

function printHelp(): void {
  console.log(`[bulk-seed] 合成 Customer 寫入 DB（provider=${BULK_PROVIDER}）`);
  console.log("");
  printListTiers();
  console.log("選項：--wipe | --dry-run | --tier=N | --count=N | --batch=N | --offset=N | --list-tiers | --help");
}

async function main() {
  if (process.argv.includes("--list-tiers")) {
    printListTiers();
    return;
  }
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }

  const wipe = process.argv.includes("--wipe");
  const dryRun = process.argv.includes("--dry-run");
  const count = resolveTargetCount();
  const batch = parseIntArg(
    "--batch=",
    Number(process.env.BULK_SEED_BATCH || "2000"),
    50,
    10_000
  );
  const phoneOffset = parseIntArg(
    "--offset=",
    Number(process.env.BULK_SEED_OFFSET || "0"),
    0,
    2_000_000_000
  );

  const prisma = new PrismaClient();
  try {
    if (wipe) {
      const r = await prisma.customer.deleteMany({ where: { provider: BULK_PROVIDER } });
      console.log(`[bulk-seed] wipe: deleted ${r.count} rows (provider=${BULK_PROVIDER})`);
    }

    const tierArg = parseArg("--tier=", "").trim();
    console.log(
      `[bulk-seed] target=${count.toLocaleString()} rows` +
        (tierArg ? ` (--tier=${tierArg})` : hasArgPrefix("--count=") ? " (--count)" : " (default/env)") +
        `, batch=${batch}, offset=${phoneOffset}`
    );

    const country = "台灣";
    const t0 = Date.now();
    let inserted = 0;

    for (let start = 0; start < count; start += batch) {
      const slice = Math.min(batch, count - start);
      const rows: Prisma.CustomerCreateManyInput[] = [];

      for (let i = 0; i < slice; i += 1) {
        const seq = phoneOffset + start + i;
        // 09 + 9 位數字 → 與既有 seed 六筆樣本不易重疊；序號可拉到 1e9 量級
        const phone = `09${String(seq).padStart(9, "0")}`;
        const phoneNormalized = normalizePhoneDigits(phone);
        const cuid = cuidFromCountryPhone(country, phone);
        rows.push({
          cuid,
          country,
          phone,
          phoneNormalized,
          provider: BULK_PROVIDER,
          name: `壓測列 ${seq}`,
          englishName: "",
          age: seq % 80,
          birthDate: "",
          position: "QA",
          salary: 50000 + (seq % 10000),
          email: `bulk${seq}@example.invalid`,
          department: "壓測",
          importRecord: "",
          exportRecord: "",
          recipient: "",
          isError: false,
          remarkLatest: "",
          attrs: { _bulkSeed: true, seq },
        });
      }

      if (dryRun && start === 0) {
        console.log("[bulk-seed] dry-run sample row:", JSON.stringify(rows[0], null, 2));
        return;
      }

      const r = await prisma.customer.createMany({
        data: rows,
        skipDuplicates: true,
      });
      inserted += r.count;
      if ((start + slice) % (batch * 5) === 0 || start + slice >= count) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`[bulk-seed] ${inserted}/${count} rows (${elapsed}s elapsed)`);
      }
    }

    const sec = ((Date.now() - t0) / 1000).toFixed(2);
    console.log(`[bulk-seed] done: inserted≈${inserted} (skipDuplicates may skip collisions) in ${sec}s`);
    console.log(`[bulk-seed] next: cd server && npm run perf:loadtest`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
