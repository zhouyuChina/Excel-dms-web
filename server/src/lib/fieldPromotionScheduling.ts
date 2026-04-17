import type { PrismaClient } from "@prisma/client";
import {
  FIELD_PROMOTION_APPLY_TYPE,
  getFieldPromotionStateLabel,
  parseFieldPromotionPayload,
} from "./fieldPromotion.js";

export async function queueScheduledFieldPromotionsForRestart(prisma: PrismaClient) {
  const repo = (prisma as any).jobQueue;
  const fieldRepo = (prisma as any).fieldDefinition;
  const scheduled = await repo.findMany({
    where: {
      source: "field-promotion",
      type: FIELD_PROMOTION_APPLY_TYPE,
      status: "completed",
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  if (!scheduled.length) return 0;
  let activated = 0;
  const now = new Date();
  for (const job of scheduled) {
    const payload = parseFieldPromotionPayload(job.payload);
    if (payload.state !== "scheduled-on-restart") continue;
    const keys = (payload.fields || []).map((field) => field.key).filter(Boolean);
    payload.state = "scheduled-on-restart";
    payload.lastError = undefined;
    await repo.update({
      where: { id: String(job.id) },
      data: {
        payload: payload as any,
        status: "queued",
        subtitle: getFieldPromotionStateLabel("scheduled-on-restart"),
        message: "field_promotion_apply_queued_on_restart",
        progressDone: 0,
        progressTotal: 1,
        error: null,
        startedAt: null,
        finishedAt: null,
        result: null,
      },
    });
    if (keys.length > 0) {
      await fieldRepo.updateMany({
        where: { key: { in: keys } },
        data: {
          promotionStatus: "scheduled-on-restart",
          promotionUpdatedAt: now,
        },
      });
    }
    activated += 1;
  }
  return activated;
}
