import type { Prisma, PrismaClient } from "@prisma/client";
import { buildCustomerWhere } from "./customerWhere.js";
import { getJob, updateJobProgress } from "./jobQueue.js";
import { isValidPhoneByCountry, normalizePhoneDigits } from "./phoneCountryRules.js";
import {
  applyPromotedFpValuesForCuids,
  loadPromotedWritableColumns,
  stripPromotedKeysToFpValues,
} from "./promotedSync.js";

type CleanInvalidRule = "phone_empty" | "email_invalid" | "phone_country_invalid";
type CleanInvalidMode = "quarantine" | "delete";

const SELECTED_CHUNK_SIZE = 5000;
const UPDATE_CONCURRENCY = 40;

function chunk<T>(arr: T[], size: number): T[][] {
  if (arr.length <= size) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (!items.length) return;
  let cursor = 0;
  const size = Math.max(1, Math.min(concurrency, items.length));
  const runners = Array.from({ length: size }, async () => {
    for (;;) {
      const idx = cursor++;
      if (idx >= items.length) return;
      await worker(items[idx] as T);
    }
  });
  await Promise.all(runners);
}

function isValidEmail(email: string): boolean {
  const s = String(email || "").trim();
  return !!s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function normalizeCleanRules(rules: unknown): CleanInvalidRule[] {
  const allowed: CleanInvalidRule[] = ["phone_empty", "email_invalid", "phone_country_invalid"];
  const list = Array.isArray(rules) ? rules.map((x) => String(x || "").trim()).filter(Boolean) : [];
  const picked = list.filter((x): x is CleanInvalidRule => allowed.includes(x as CleanInvalidRule));
  return picked.length ? [...new Set(picked)] : ["phone_empty"];
}

function classifyPhoneLengthReason(phone: string): string | null {
  const normalized = normalizePhoneDigits(phone);
  if (!normalized) return "phone_empty";
  if (normalized.length === 11) return "phone_extra_1";
  if (normalized.length > 11) return "phone_extra_2";
  if (normalized.length === 9) return "phone_short_1";
  if (normalized.length < 9) return "phone_short_2";
  return null;
}

function isAlreadyQuarantinedByCleanInvalid(row: { isError?: boolean; attrs?: unknown }): boolean {
  if (!row.isError) return false;
  const attrs =
    row.attrs && typeof row.attrs === "object" && !Array.isArray(row.attrs)
      ? (row.attrs as Record<string, unknown>)
      : null;
  return String(attrs?.__quarantineSource || "") === "clean-invalid";
}

async function loadTargetRows(
  prisma: PrismaClient,
  target: "selected" | "filtered" | "all",
  selectedCuids: string[],
  filterSnapshot: any,
) {
  if (target === "selected") {
    const rows: Array<{ cuid: string; country: string; phone: string; phoneNormalized: string; email: string; attrs: unknown }> = [];
    for (const ids of chunk(selectedCuids, SELECTED_CHUNK_SIZE)) {
      const part = await prisma.customer.findMany({
        where: { cuid: { in: ids } },
        select: { cuid: true, country: true, phone: true, phoneNormalized: true, email: true, isError: true, attrs: true },
      });
      for (const item of part as any[]) {
        if (isAlreadyQuarantinedByCleanInvalid(item)) continue;
        rows.push(item);
      }
    }
    return { targetRows: rows.length, rows };
  }
  const baseWhere: Prisma.CustomerWhereInput =
    target === "all"
      ? {}
      : buildCustomerWhere({
          exportStatus: String(filterSnapshot?.exportStatus || "all"),
          q: String(filterSnapshot?.q || ""),
          providerExact: String(filterSnapshot?.providerExact || "").trim(),
          countryExact: String(filterSnapshot?.countryExact || "").trim(),
          filterRules: Array.isArray(filterSnapshot?.filters) ? filterSnapshot.filters : [],
        });
  const excludeExistingQuarantine: Prisma.CustomerWhereInput = {
    NOT: {
      AND: [{ isError: true }, { attrs: { path: ["__quarantineSource"], equals: "clean-invalid" } }],
    },
  };
  const where: Prisma.CustomerWhereInput =
    Object.keys(baseWhere || {}).length === 0
      ? excludeExistingQuarantine
      : { AND: [baseWhere, excludeExistingQuarantine] };
  const [targetRows, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      select: { cuid: true, country: true, phone: true, phoneNormalized: true, email: true, attrs: true, isError: true },
      take: 200000,
    }),
  ]);
  return { targetRows, rows: rows as any[] };
}

export async function runCleanInvalidQueueJob(prisma: PrismaClient, queueJobId: string) {
  const job = await getJob(prisma, queueJobId);
  if (!job) return;
  const payload = ((job as any).payload || {}) as {
    target?: "selected" | "filtered" | "all";
    cuids?: string[];
    rules?: CleanInvalidRule[];
    mode?: CleanInvalidMode;
    filterSnapshot?: Record<string, unknown>;
  };
  const target = payload.target || "filtered";
  const rules = normalizeCleanRules(payload.rules);
  const mode: CleanInvalidMode = payload.mode === "delete" ? "delete" : "quarantine";
  const selectedCuids = Array.isArray(payload.cuids) ? [...new Set(payload.cuids.map((x) => String(x || "").trim()).filter(Boolean))] : [];
  await updateJobProgress(prisma, queueJobId, {
    status: "processing",
    startedAt: new Date(),
    progressDone: 0,
    progressTotal: 1,
    message: "清理檢查中",
  });
  const { targetRows, rows } = await loadTargetRows(prisma, target, selectedCuids, payload.filterSnapshot || {});
  await updateJobProgress(prisma, queueJobId, {
    status: "processing",
    progressDone: 0,
    progressTotal: Math.max(1, targetRows),
    message: `掃描中 0/${Math.max(1, targetRows)}`,
  });
  const byRule: Record<string, number> = {};
  const reasonByCuid = new Map<string, Set<string>>();
  const invalidCuids = new Set<string>();
  const targetProgressTotal = Math.max(1, targetRows);
  const scanWeight = 0.7;
  const handleWeight = 0.3;
  let scanned = 0;
  for (const row of rows) {
    const phoneEmpty = !String(row.phone || "").trim() || !String(row.phoneNormalized || "").trim();
    const emailInvalid = String(row.email || "").trim() !== "" && !isValidEmail(String(row.email || ""));
    const phoneCountryInvalid = String(row.phone || "").trim() !== "" && !isValidPhoneByCountry(String(row.country || ""), String(row.phone || ""));
    const lengthReason = classifyPhoneLengthReason(String(row.phone || ""));
    const reasons = reasonByCuid.get(String(row.cuid)) || new Set<string>();
    if (rules.includes("phone_empty") && phoneEmpty) {
      byRule.phone_empty = (byRule.phone_empty || 0) + 1;
      invalidCuids.add(String(row.cuid));
      reasons.add("phone_empty");
    }
    if (rules.includes("email_invalid") && emailInvalid) {
      byRule.email_invalid = (byRule.email_invalid || 0) + 1;
      invalidCuids.add(String(row.cuid));
      reasons.add("email_invalid");
    }
    if (rules.includes("phone_country_invalid") && phoneCountryInvalid) {
      const reasonKey = lengthReason || "country_phone_mismatch";
      byRule[reasonKey] = (byRule[reasonKey] || 0) + 1;
      invalidCuids.add(String(row.cuid));
      reasons.add(reasonKey);
    }
    if (reasons.size > 0) reasonByCuid.set(String(row.cuid), reasons);
    scanned += 1;
    if (scanned % 1000 === 0) {
      const progressDone = Math.min(
        targetProgressTotal,
        Math.floor((scanned / targetProgressTotal) * targetProgressTotal * scanWeight)
      );
      await updateJobProgress(prisma, queueJobId, {
        status: "processing",
        progressDone,
        progressTotal: targetProgressTotal,
        message: `掃描中 ${scanned}/${targetProgressTotal}`,
      });
    }
  }
  const invalidRows = invalidCuids.size;
  await updateJobProgress(prisma, queueJobId, {
    status: "processing",
    progressDone: Math.floor(targetProgressTotal * scanWeight),
    progressTotal: targetProgressTotal,
    message: `掃描完成，處理無效資料 ${invalidRows} 筆`,
  });
  let deletedRows = 0;
  let quarantinedRows = 0;
  if (invalidRows > 0) {
    const cuids = [...invalidCuids];
    let handled = 0;
    if (mode === "delete") {
      for (const ids of chunk(cuids, SELECTED_CHUNK_SIZE)) {
        const result = await prisma.customer.deleteMany({ where: { cuid: { in: ids } } });
        deletedRows += Number(result.count || 0);
        handled += ids.length;
        const handleRatio = invalidRows > 0 ? handled / invalidRows : 1;
        const progressDone = Math.min(
          targetProgressTotal,
          Math.floor(targetProgressTotal * scanWeight + targetProgressTotal * handleWeight * handleRatio)
        );
        await updateJobProgress(prisma, queueJobId, {
          status: "processing",
          progressDone,
          progressTotal: targetProgressTotal,
          message: `刪除中 ${handled}/${invalidRows}`,
        });
      }
    } else {
      const promotedWritable = await loadPromotedWritableColumns(prisma);
      for (const ids of chunk(cuids, SELECTED_CHUNK_SIZE)) {
        const partRows = await prisma.customer.findMany({ where: { cuid: { in: ids } }, select: { cuid: true, attrs: true } });
        const fpChunk: Array<{ cuid: string; fpValues: Record<string, string> }> = [];
        await runWithConcurrency(partRows as any[], UPDATE_CONCURRENCY, async (row) => {
          const attrs = row.attrs && typeof row.attrs === "object" && !Array.isArray(row.attrs) ? { ...(row.attrs as Record<string, unknown>) } : {};
          attrs.__invalidReasons = [...(reasonByCuid.get(String(row.cuid)) || new Set<string>())];
          attrs.__quarantineAt = new Date().toISOString();
          attrs.__quarantineSource = "clean-invalid";
          const { attrs: cleanAttrs, fpValues } = stripPromotedKeysToFpValues(attrs, promotedWritable);
          if (Object.keys(fpValues).length > 0) fpChunk.push({ cuid: String(row.cuid), fpValues });
          await prisma.customer.update({
            where: { cuid: String(row.cuid) },
            data: { isError: true, attrs: cleanAttrs as Prisma.InputJsonValue },
          });
          quarantinedRows += 1;
          handled += 1;
        });
        if (fpChunk.length) await applyPromotedFpValuesForCuids(prisma, fpChunk);
        const handleRatio = invalidRows > 0 ? handled / invalidRows : 1;
        const progressDone = Math.min(
          targetProgressTotal,
          Math.floor(targetProgressTotal * scanWeight + targetProgressTotal * handleWeight * handleRatio)
        );
        await updateJobProgress(prisma, queueJobId, {
          status: "processing",
          progressDone,
          progressTotal: targetProgressTotal,
          message: `隔離中 ${handled}/${invalidRows}`,
        });
      }
    }
  }
  await updateJobProgress(prisma, queueJobId, {
    status: "completed",
    progressDone: targetProgressTotal,
    progressTotal: targetProgressTotal,
    finishedAt: new Date(),
    message: "清理完成",
    result: { targetRows, invalidRows, deletedRows, quarantinedRows, mode, rules, byRule },
  });
}

