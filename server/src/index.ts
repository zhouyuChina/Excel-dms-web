import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import cors from "cors";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { registerCustomers } from "./routes/customers.js";
import { registerFieldDefinitions } from "./routes/fieldDefinitions.js";
import { registerFieldGroups } from "./routes/fieldGroups.js";
import { registerImports } from "./routes/imports.js";
import { registerExports } from "./routes/exports.js";
import { registerAuditLogs } from "./routes/auditLogs.js";
import { registerAuth } from "./routes/auth.js";
import { registerRecovery } from "./routes/recovery.js";
import { registerJobs } from "./routes/jobs.js";
import { FIELD_PROMOTION_APPLY_TYPE, parseFieldPromotionPayload } from "./lib/fieldPromotion.js";
import { runFieldPromotionQueueJob } from "./lib/fieldPromotionJobRunner.js";
import { queueScheduledFieldPromotionsForRestart } from "./lib/fieldPromotionScheduling.js";
import { reconcilePromotedMetadataDrift } from "./lib/promotedSync.js";

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT) || 8080;
const useExternalWorker = process.env.JOB_EXECUTION_MODE === "worker";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: true });
  } catch {
    res.status(503).json({ ok: false, db: false });
  }
});

app.get("/api/footer", async (_req, res) => {
  res.json({
    user: "本機開發",
    version: "v0.1.0-mvp",
    serverTime: new Date().toISOString(),
    perf: 0.95,
    ok: true,
    db: true,
  });
});

registerCustomers(app, prisma);
registerAuth(app);
registerFieldDefinitions(app, prisma);
registerFieldGroups(app, prisma);
registerImports(app, prisma);
registerJobs(app, prisma);
registerExports(app, prisma);
registerAuditLogs(app);
registerRecovery(app, prisma);

// ── 靜態前端（production build）──────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, "../../dist");
if (existsSync(path.join(frontendDist, "index.html"))) {
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
  console.log(`[api] serving frontend from ${frontendDist}`);
}

async function autoSeedFieldDefinitions() {
  const count = await prisma.fieldDefinition.count();
  if (count > 0) return;
  console.log("[api] 資料庫無欄位定義，自動建立預設欄位...");

  const groups = [
    { id: "seed-group-系統欄位", name: "系統欄位", color: "bg-purple-500", isSystem: true, sortOrder: 0 },
    { id: "seed-group-個人資訊", name: "個人資訊", color: "bg-blue-500", isSystem: false, sortOrder: 1 },
    { id: "seed-group-工作相關", name: "工作相關", color: "bg-green-500", isSystem: false, sortOrder: 2 },
    { id: "seed-group-聯絡方式", name: "聯絡方式", color: "bg-orange-500", isSystem: false, sortOrder: 3 },
  ];
  const groupRows: Record<string, string> = {};
  for (const g of groups) {
    const row = await prisma.fieldGroup.upsert({
      where: { id: g.id },
      create: g,
      update: { name: g.name, color: g.color, sortOrder: g.sortOrder },
    });
    groupRows[g.name] = row.id;
  }

  const fields: Array<{
    key: string; name: string; uiColor: string; type: string;
    aliases?: string[]; source?: string;
    isRequired: boolean; isSystem: boolean; defaultVisible: boolean;
    isExportable?: boolean; sortOrder: number; group: string;
  }> = [
    { key: "cuid", name: "CUID", uiColor: "bg-blue-500", type: "系統", aliases: ["cuid", "id"], source: "system", isRequired: true, isSystem: true, defaultVisible: true, isExportable: true, sortOrder: 0, group: "系統欄位" },
    { key: "country", name: "國家", uiColor: "bg-green-500", type: "系統", aliases: ["country", "國別"], source: "system", isRequired: true, isSystem: true, defaultVisible: true, isExportable: true, sortOrder: 1, group: "系統欄位" },
    { key: "provider", name: "提供者", uiColor: "bg-yellow-500", type: "系統", aliases: ["provider", "來源"], source: "system", isRequired: false, isSystem: true, defaultVisible: true, isExportable: true, sortOrder: 2, group: "系統欄位" },
    { key: "phone", name: "電話號碼", uiColor: "bg-purple-500", type: "電話", aliases: ["phone", "phone number", "mobile", "tel", "電話", "手機", "行動電話"], source: "system", isRequired: true, isSystem: true, defaultVisible: true, isExportable: true, sortOrder: 3, group: "系統欄位" },
    { key: "name", name: "姓名", uiColor: "bg-red-500", type: "中文姓名", aliases: ["name", "last name", "lastname", "中文姓名"], source: "system", isRequired: true, isSystem: false, defaultVisible: true, isExportable: true, sortOrder: 4, group: "個人資訊" },
    { key: "englishName", name: "英文姓名", uiColor: "bg-indigo-500", type: "英文姓名", aliases: ["english name", "first name", "firstname", "英文姓名"], source: "system", isRequired: false, isSystem: false, defaultVisible: false, isExportable: true, sortOrder: 5, group: "個人資訊" },
    { key: "age", name: "年齡", uiColor: "bg-pink-500", type: "數字", isRequired: true, isSystem: false, defaultVisible: false, sortOrder: 6, group: "個人資訊" },
    { key: "birthDate", name: "出生日期", uiColor: "bg-orange-500", type: "日期", isRequired: true, isSystem: false, defaultVisible: false, sortOrder: 7, group: "個人資訊" },
    { key: "position", name: "職位", uiColor: "bg-teal-500", type: "文字", isRequired: false, isSystem: false, defaultVisible: false, sortOrder: 8, group: "工作相關" },
    { key: "salary", name: "薪資", uiColor: "bg-cyan-500", type: "數字", isRequired: false, isSystem: false, defaultVisible: false, sortOrder: 9, group: "工作相關" },
    { key: "email", name: "電子郵件", uiColor: "bg-emerald-500", type: "電子郵件", aliases: ["email", "email address", "e-mail", "mail", "郵件", "電子郵件"], source: "system", isRequired: false, isSystem: false, defaultVisible: false, isExportable: true, sortOrder: 10, group: "聯絡方式" },
    { key: "department", name: "部門", uiColor: "bg-slate-500", type: "文字", isRequired: false, isSystem: false, defaultVisible: false, sortOrder: 11, group: "工作相關" },
    { key: "importRecord", name: "匯入紀錄", uiColor: "bg-violet-500", type: "文字", source: "system", isRequired: false, isSystem: true, defaultVisible: false, isExportable: true, sortOrder: 12, group: "系統欄位" },
    { key: "exportRecord", name: "匯出紀錄", uiColor: "bg-rose-500", type: "文字", source: "system", isRequired: false, isSystem: true, defaultVisible: false, isExportable: true, sortOrder: 13, group: "系統欄位" },
    { key: "recipient", name: "接收者", uiColor: "bg-amber-500", type: "文字", isRequired: false, isSystem: false, defaultVisible: false, sortOrder: 14, group: "工作相關" },
  ];
  for (const f of fields) {
    await prisma.fieldDefinition.create({
      data: {
        key: f.key, name: f.name, uiColor: f.uiColor, type: f.type,
        category: "",
        aliases: f.aliases ?? [],
        source: f.source ?? (f.isSystem ? "system" : "manual"),
        isRequired: f.isRequired, isSystem: f.isSystem,
        defaultVisible: f.defaultVisible,
        isExportable: f.isExportable ?? true,
        sortOrder: f.sortOrder,
        groupId: groupRows[f.group],
      },
    });
  }
  console.log(`[api] ✓ 已建立 ${fields.length} 個預設欄位定義`);
}

async function recoverStuckJobsOnApiStart() {
  if (useExternalWorker) return;
  const repo = (prisma as any).jobQueue;
  const stuck = await repo.findMany({
    where: { status: "processing" },
    orderBy: { updatedAt: "asc" },
    take: 1000,
  });
  if (!stuck.length) return;
  for (const job of stuck) {
    await repo.update({
      where: { id: String(job.id) },
      data: {
        status: "failed",
        message: "api_restarted_mark_failed",
        error: "api_interrupted",
        finishedAt: new Date(),
      },
    });
  }
  console.log(`[api] recovered stuck processing jobs: ${stuck.length}`);
}

async function resumeScheduledFieldPromotionsOnApiStart() {
  if (useExternalWorker) return;
  const activated = await queueScheduledFieldPromotionsForRestart(prisma);
  if (activated > 0) {
    console.log(`[api] queued scheduled field promotions on restart: ${activated}`);
  }
  const repo = (prisma as any).jobQueue;
  const queued = await repo.findMany({
    where: {
      source: "field-promotion",
      type: FIELD_PROMOTION_APPLY_TYPE,
      status: "queued",
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  for (const job of queued) {
    const payload = parseFieldPromotionPayload(job.payload);
    if (payload.state !== "scheduled-on-restart") continue;
    await runFieldPromotionQueueJob(prisma, String(job.id));
  }
}

async function reconcilePromotedColumnsOnApiStart() {
  const result = await reconcilePromotedMetadataDrift(prisma);
  if (result.fixed > 0) {
    console.warn(`[api] reconciled promoted metadata drift: ${result.fixed}`);
  }
}

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response
  ) => {
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  }
);

void autoSeedFieldDefinitions()
  .then(() => recoverStuckJobsOnApiStart())
  .then(() => resumeScheduledFieldPromotionsOnApiStart())
  .then(() => reconcilePromotedColumnsOnApiStart())
  .catch((err) => {
    console.error("[api] recoverStuckJobsOnApiStart failed", err);
  })
  .finally(() => {
    app.listen(port, "127.0.0.1", () => {
      console.log(`dms-api http://127.0.0.1:${port}`);
    });
  });
