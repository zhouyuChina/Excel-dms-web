/// <reference types="node" />
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CliMode = "backfill" | "rollback";

function parseMode(): CliMode {
  const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
  const mode = modeArg?.split("=")[1];
  if (mode === "rollback") return "rollback";
  return "backfill";
}

async function tableExists(tableName: string) {
  const rows = (await prisma.$queryRawUnsafe(
    `select to_regclass('${tableName}')::text as name`
  )) as Array<{ name: string | null }>;
  return Boolean(rows[0]?.name);
}

function escapeLiteral(value: string) {
  return value.replace(/'/g, "''");
}

async function pickFirstExistingTable(candidates: string[]) {
  for (const table of candidates) {
    if (await tableExists(table)) return table;
  }
  return null;
}

async function querySingleNumber(sql: string) {
  const rows = (await prisma.$queryRawUnsafe(sql)) as Array<Record<string, unknown>>;
  const value = Object.values(rows[0] ?? {})[0];
  return Number(value ?? 0);
}

async function runBackfillDrill() {
  const customerTable =
    (await pickFirstExistingTable(['public."Customer"', "public.customer"])) || "public.customer";
  const shadowTable = await pickFirstExistingTable(['public."Customer_v2"', "public.customer_p"]);
  const customerExists = await tableExists(customerTable);
  if (!customerExists) throw new Error("public.customer 不存在，無法演練");
  if (!shadowTable) {
    const baseCount = await querySingleNumber(`select count(*) from ${customerTable}`);
    console.log("=== Backfill Drill ===");
    console.log(`customer table     : ${customerTable}`);
    console.log(`customer rows      : ${baseCount}`);
    console.log("shadow table       : (not found)");
    console.log("");
    console.log("目前為單表基線（尚未建立分區影子表）。");
    console.log("若要進入 cutover 演練，請先建立 Customer_v2 或 customer_p。");
    return;
  }

  const shadow = shadowTable;
  const baseCount = await querySingleNumber(`select count(*) from ${customerTable}`);
  const shadowCount = await querySingleNumber(`select count(*) from ${shadow}`);
  const missingInShadow = await querySingleNumber(
    `select count(*) from ${customerTable} c where not exists (select 1 from ${shadow} p where p.cuid = c.cuid)`
  );
  const partitionCount = await querySingleNumber(
    `select count(*) from pg_inherits i where i.inhparent = to_regclass('${escapeLiteral(shadow)}')`
  );

  console.log("=== Backfill Drill ===");
  console.log(`customer table     : ${customerTable}`);
  console.log(`shadow table       : ${shadow}`);
  console.log(`customer rows      : ${baseCount}`);
  console.log(`shadow rows        : ${shadowCount}`);
  console.log(`missing in shadow  : ${missingInShadow}`);
  console.log(`partition count    : ${partitionCount}`);
  console.log("");
  console.log("建議通過門檻:");
  console.log("- missing in shadow = 0");
  console.log("- partition count >= 2（至少有目前與下個區間）");
  console.log("- customer 與 customer_p row count 差異在可解釋範圍");
}

async function runRollbackDrill() {
  const backupTable = await pickFirstExistingTable(["public.customer_backup", 'public."Customer_backup"']);
  const activeTable = await pickFirstExistingTable(["public.customer", 'public."Customer"']);
  const shadowTable = await pickFirstExistingTable(["public.customer_p", 'public."Customer_v2"']);
  const backupExists = Boolean(backupTable);
  const activeExists = Boolean(activeTable);
  const shadowExists = Boolean(shadowTable);

  console.log("=== Rollback Drill ===");
  console.log(`customer table         : ${activeTable ?? "(not found)"}`);
  console.log(`shadow table           : ${shadowTable ?? "(not found)"}`);
  console.log(`backup table           : ${backupTable ?? "(not found)"}`);
  console.log(`customer exists        : ${activeExists}`);
  console.log(`shadow exists          : ${shadowExists}`);
  console.log(`customer_backup exists : ${backupExists}`);
  console.log("");
  console.log("建議演練步驟（不自動執行）:");
  console.log("1) 以 transaction 包住 rename swap。");
  console.log("2) 將 customer 改名為 customer_failed_cutover。");
  console.log("3) 將 customer_backup 改回 customer。");
  console.log("4) 驗證 API smoke test 與 row count。");
  console.log("5) 觀察 15 分鐘後再決定是否重新 cutover。");
}

async function main() {
  const mode = parseMode();
  if (mode === "rollback") await runRollbackDrill();
  else await runBackfillDrill();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
