import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { enqueueJob } from "../lib/jobQueue.js";
import { runExportQueueJob } from "../lib/exportJobRunner.js";

type ExportJobRow = Awaited<
  ReturnType<PrismaClient["exportJob"]["findMany"]>
>[number];
type CustomerExportMarkRow = Awaited<
  ReturnType<PrismaClient["customerExportMark"]["findMany"]>
>[number];
export function registerExports(app: Express, prisma: PrismaClient) {
  const exportDir = path.join(process.cwd(), "uploads", "exports");
  fs.mkdirSync(exportDir, { recursive: true });
  const useExternalWorker = process.env.JOB_EXECUTION_MODE === "worker";
  const dedupeWindowSec = Math.max(10, Number(process.env.EXPORT_DEDUPE_WINDOW_SEC || 60));

  app.get("/api/exports", async (_req, res) => {
    const list = await prisma.exportJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    res.json({
      items: list.map((j: ExportJobRow) => ({
        id: j.id,
        fileName: j.fileName,
        rowCount: j.rowCount,
        recipient: j.recipient,
        remarks: j.remarks,
        createdAt: j.createdAt.toISOString(),
      })),
    });
  });

  app.get("/api/exports/:id/download", async (req, res) => {
    const job = await prisma.exportJob.findUnique({
      where: { id: req.params.id },
    });
    if (!job) return res.status(404).json({ error: "not_found" });
    if (!fs.existsSync(job.filePath)) {
      return res.status(404).json({ error: "file_missing" });
    }
    res.download(job.filePath, job.fileName);
  });

  app.delete("/api/exports/:id", async (req, res) => {
    const id = req.params.id;
    const job = await prisma.exportJob.findUnique({
      where: { id },
      include: { marks: true },
    });
    if (!job) return res.status(404).json({ error: "not_found" });
    const cuids = [...new Set(job.marks.map((m: CustomerExportMarkRow) => m.cuid))];
    if (fs.existsSync(job.filePath)) {
      try {
        fs.unlinkSync(job.filePath);
      } catch {
        /* ignore */
      }
    }
    await prisma.exportJob.delete({ where: { id } });
    for (const cuid of cuids) {
      const cnt = await prisma.customerExportMark.count({ where: { cuid } });
      if (cnt === 0) {
        await prisma.customer.update({
          where: { cuid },
          data: { exportRecord: "" },
        });
      }
    }
    res.status(204).send();
  });

  app.post("/api/exports", async (req, res) => {
    const body = req.body as {
      filterSnapshot?: {
        q?: string;
        exportStatus?: string;
        filters?: Array<{ field: string; operator: string; value: string }>;
        sortField?: string;
        sortDir?: string;
        visibleFieldKeys?: string[];
      };
      recipient?: string;
      remarks?: string;
    };
    const recipient = String(body.recipient || "").trim();
    const remarks = String(body.remarks || "").trim();
    if (!recipient) {
      return res.status(400).json({ error: "recipient_required" });
    }
    const snap = body.filterSnapshot || {};
    const dedupeKey = `export:${recipient}:${Buffer.from(
      JSON.stringify({ snap, remarks })
    ).toString("base64url")}`;
    const recent = await (prisma as any).jobQueue.findFirst({
      where: {
        source: "export",
        dedupeKey,
        status: { in: ["queued", "processing", "completed"] },
        createdAt: {
          gte: new Date(Date.now() - dedupeWindowSec * 1000),
        },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      return res.status(202).json({
        status: String((recent as any).status || "queued"),
        jobId: String((recent as any).id),
        deduped: true,
        queuePosition: Number((recent as any).queuePosition ?? 0),
        estimatedWaitSec: Number((recent as any).estimatedWaitSec ?? 0),
      });
    }
    const { item: queuedJob, deduped } = await enqueueJob(prisma, {
      source: "export",
      type: "export-csv",
      title: `匯出 CSV：${recipient}`,
      subtitle: remarks || "依目前篩選結果匯出",
      payload: {
        recipient,
        remarks,
        filterSnapshot: snap,
      },
      dedupeKey,
    });
    if (!useExternalWorker) {
      setImmediate(() => {
        void runExportQueueJob(prisma, String((queuedJob as any).id));
      });
    }
    res.status(202).json({
      status: String((queuedJob as any).status || "queued"),
      jobId: String((queuedJob as any).id),
      deduped,
      queuePosition: Number((queuedJob as any).queuePosition ?? 0),
      estimatedWaitSec: Number((queuedJob as any).estimatedWaitSec ?? 0),
    });
  });
}
