import type { PrismaClient } from "@prisma/client";
import {
  FIELD_PROMOTION_APPLY_TYPE,
  FIELD_PROMOTION_PLAN_TYPE,
} from "./fieldPromotion.js";

type EnqueueJobInput = {
  source: "merge-fields" | "import" | "export" | "clean-invalid" | "field-promotion";
  type: string;
  title: string;
  subtitle?: string;
  payload: Record<string, unknown>;
  dedupeKey?: string;
  maxAttempts?: number;
};

export async function enqueueJob(prisma: PrismaClient, input: EnqueueJobInput) {
  const repo = (prisma as any).jobQueue;
  if (input.dedupeKey) {
    const existing = await repo.findFirst({
      where: {
        dedupeKey: input.dedupeKey,
        status: { in: ["queued", "processing"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return { item: existing, deduped: true };
    }
  }
  const queueAhead = await repo.count({ where: { status: "queued", source: input.source } });
  const item = await repo.create({
    data: {
      source: input.source,
      type: input.type,
      status: "queued",
      payload: input.payload as any,
      title: input.title,
      subtitle: input.subtitle || "",
      dedupeKey: input.dedupeKey || null,
      queuePosition: queueAhead + 1,
      estimatedWaitSec: Math.max(5, queueAhead * 4),
      maxAttempts: input.maxAttempts ?? 3,
    },
  });
  return { item, deduped: false };
}

export async function listJobs(prisma: PrismaClient, params?: { source?: string; limit?: number }) {
  const repo = (prisma as any).jobQueue;
  return repo.findMany({
    where: params?.source ? { source: params.source } : undefined,
    orderBy: { createdAt: "desc" },
    take: params?.limit ?? 100,
  });
}

export async function getJob(prisma: PrismaClient, id: string) {
  const repo = (prisma as any).jobQueue;
  return repo.findUnique({ where: { id } });
}

export async function claimNextQueuedJob(prisma: PrismaClient) {
  const repo = (prisma as any).jobQueue;
  const next = await repo.findFirst({
    where: {
      status: "queued",
      OR: [
        { source: "merge-fields" },
        { source: "import" },
        { source: "export" },
        { source: "clean-invalid" },
        {
          source: "field-promotion",
          type: { in: [FIELD_PROMOTION_PLAN_TYPE, FIELD_PROMOTION_APPLY_TYPE] },
        },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  if (!next) return null;
  const lock = await repo.updateMany({
    where: { id: next.id, status: "queued" },
    data: {
      status: "processing",
      queuePosition: 0,
      estimatedWaitSec: 0,
      startedAt: new Date(),
      attempt: { increment: 1 },
    },
  });
  if (!lock.count) return null;
  return repo.findUnique({ where: { id: next.id } });
}

export async function updateJobProgress(
  prisma: PrismaClient,
  id: string,
  patch: {
    status?: "queued" | "processing" | "completed" | "failed";
    progressDone?: number;
    progressTotal?: number;
    message?: string | null;
    error?: string | null;
    result?: Record<string, unknown>;
    queuePosition?: number;
    estimatedWaitSec?: number;
    startedAt?: Date;
    finishedAt?: Date;
  }
) {
  const repo = (prisma as any).jobQueue;
  return repo.update({
    where: { id },
    data: {
      status: patch.status,
      progressDone: patch.progressDone,
      progressTotal: patch.progressTotal,
      message: patch.message,
      error: patch.error,
      result: patch.result as any,
      queuePosition: patch.queuePosition,
      estimatedWaitSec: patch.estimatedWaitSec,
      startedAt: patch.startedAt,
      finishedAt: patch.finishedAt,
    },
  });
}

