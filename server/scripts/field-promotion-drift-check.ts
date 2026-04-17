/**
 * 離線檢查：FieldDefinition 已 promoted/applied 但 Customer 缺少對應 fp_* 欄位。
 * 用法：cd server && npx tsx scripts/field-promotion-drift-check.ts
 * 發現漂移時 exit code 1（適合 CI / 部署後探針）。
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { findPromotedMetadataDrift } from "../src/lib/promotedSync.js";

async function main() {
  const prisma = new PrismaClient();
  try {
    const drift = await findPromotedMetadataDrift(prisma);
    console.log(JSON.stringify({ count: drift.length, drift }, null, 2));
    if (drift.length > 0) {
      console.error(`[field-promotion-drift-check] FAIL: ${drift.length} drift(s)`);
      process.exitCode = 1;
    } else {
      console.log("[field-promotion-drift-check] OK");
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
