import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { claimNextQueuedJob, updateJobProgress } from "./lib/jobQueue.js";
import { runImportJob } from "./lib/importJobRunner.js";
import { runMergeFieldsQueueJob } from "./lib/mergeFieldsJobRunner.js";
import { runExportQueueJob } from "./lib/exportJobRunner.js";
import { runCleanInvalidQueueJob } from "./lib/cleanInvalidJobRunner.js";
import { runFieldPromotionQueueJob } from "./lib/fieldPromotionJobRunner.js";
import { queueScheduledFieldPromotionsForRestart } from "./lib/fieldPromotionScheduling.js";
import { reconcilePromotedMetadataDrift } from "./lib/promotedSync.js";

const prisma = new PrismaClient();
const intervalMs = Math.max(500, Number(process.env.JOB_WORKER_POLL_MS || 1500));
const recoverOnStart = process.env.JOB_WORKER_RECOVER_STUCK !== "0";

async function recoverStuckProcessingJobs() {
  const repo = (prisma as any).jobQueue;
  const importRepo = (prisma as any).importJob;
  const stuck = await repo.findMany({
    where: { status: "processing" },
    orderBy: { updatedAt: "asc" },
    take: 500,
  });
  if (!stuck.length) return;
  const now = new Date();
  for (const job of stuck) {
    await repo.update({
      where: { id: job.id },
      data: {
        status: "failed",
        message: "worker_restarted_mark_failed",
        error: "worker_interrupted",
        finishedAt: now,
      },
    });
    if (job.source === "import") {
      const payload = (job.payload || {}) as { importJobId?: string };
      const importJobId = String(payload.importJobId || "");
      if (importJobId) {
        await importRepo.updateMany({
          where: { id: importJobId, status: "processing" },
          data: {
            status: "failed",
            canRetry: true,
            errorPrimary: "worker_interrupted",
            finishedAt: now,
          },
        });
      } else {
        await importRepo.updateMany({
          where: { queueJobId: String(job.id), status: "processing" },
          data: {
            status: "failed",
            canRetry: true,
            errorPrimary: "worker_interrupted",
            finishedAt: now,
          },
        });
      }
    }
  }
  console.log(`[worker] recovered stuck processing jobs: ${stuck.length}`);
}

async function processOne() {
  const job = await claimNextQueuedJob(prisma);
  if (!job) return false;
  try {
    if (job.source === "merge-fields") {
      await runMergeFieldsQueueJob(prisma, String(job.id));
      return true;
    }
    if (job.source === "import") {
      const payload = (job.payload || {}) as { importJobId?: string };
      const importJobId = String(payload.importJobId || "");
      if (!importJobId) {
        await updateJobProgress(prisma, String(job.id), {
          status: "failed",
          error: "missing_import_job_id",
          message: "匯入任務缺少 payload",
          finishedAt: new Date(),
        });
        return true;
      }
      await runImportJob(prisma, importJobId, String(job.id));
      return true;
    }
    if (job.source === "export") {
      await runExportQueueJob(prisma, String(job.id));
      return true;
    }
    if (job.source === "clean-invalid") {
      await runCleanInvalidQueueJob(prisma, String(job.id));
      return true;
    }
    if (job.source === "field-promotion") {
      await runFieldPromotionQueueJob(prisma, String(job.id));
      return true;
    }
    await updateJobProgress(prisma, String(job.id), {
      status: "failed",
      error: "unsupported_job_source",
      message: "不支援的任務來源",
      finishedAt: new Date(),
    });
    return true;
  } catch (error) {
    await updateJobProgress(prisma, String(job.id), {
      status: "failed",
      error: error instanceof Error ? error.message : "worker_error",
      message: "worker 執行失敗",
      finishedAt: new Date(),
    });
    return true;
  }
}

async function loop() {
  for (;;) {
    const hadWork = await processOne();
    if (!hadWork) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function main() {
  if (recoverOnStart) {
    await recoverStuckProcessingJobs();
  }
  const reconciled = await reconcilePromotedMetadataDrift(prisma);
  if (reconciled.fixed > 0) {
    console.warn(`[worker] reconciled promoted metadata drift: ${reconciled.fixed}`);
  }
  const activated = await queueScheduledFieldPromotionsForRestart(prisma);
  if (activated > 0) {
    console.log(`[worker] queued scheduled field promotions on restart: ${activated}`);
  }
  await loop();
}

main()
  .then(() => undefined)
  .catch((error) => {
    console.error("[worker] fatal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
