import fs from "node:fs";
import path from "node:path";
import type { Prisma, PrismaClient } from "@prisma/client";
import { buildCustomerOrderBy, buildCustomerWhere } from "./customerWhere.js";
import { toDTO, type CustomerDTO } from "./customerMapper.js";
import { updateJobProgress } from "./jobQueue.js";
import { quoteIdentifier, toPromotedColumnName } from "./fieldPromotionSql.js";

type CustomerRow = Awaited<ReturnType<PrismaClient["customer"]["findMany"]>>[number];

const MAX_EXPORT_ROWS = 100_000;
const EXPORT_PART_ROWS = Math.max(1, Number(process.env.EXPORT_PART_ROWS || 50_000));
const CORE_VALUE_KEYS = new Set<keyof CustomerDTO>([
  "cuid",
  "country",
  "provider",
  "phone",
  "name",
  "englishName",
  "age",
  "birthDate",
  "position",
  "salary",
  "email",
  "department",
  "importRecord",
  "exportRecord",
  "recipient",
  "isError",
  "attrs",
]);

function csvEscape(v: string | number | boolean): string {
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function loadCustomerColumnNames(prisma: PrismaClient): Promise<Set<string>> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Customer'`
  )) as Array<{ column_name?: string }>;
  return new Set(rows.map((r) => String(r.column_name || "").trim()).filter(Boolean));
}

type ExportPayload = {
  recipient?: string;
  remarks?: string;
  filterSnapshot?: {
    q?: string;
    exportStatus?: string;
    filters?: Array<{ field: string; operator: string; value: string }>;
    sortField?: string;
    sortDir?: string;
    visibleFieldKeys?: string[];
  };
};

export async function runExportQueueJob(prisma: PrismaClient, queueJobId: string) {
  const queueRepo = (prisma as any).jobQueue;
  const queueJob = await queueRepo.findUnique({ where: { id: queueJobId } });
  if (!queueJob) throw new Error("queue_job_not_found");
  const payload = ((queueJob as any).payload || {}) as ExportPayload;
  const recipient = String(payload.recipient || "").trim();
  const remarks = String(payload.remarks || "").trim();
  if (!recipient) {
    await updateJobProgress(prisma, queueJobId, {
      status: "failed",
      error: "recipient_required",
      message: "請填寫接收者",
      finishedAt: new Date(),
    });
    return;
  }
  const snap = payload.filterSnapshot || {};
  const where = buildCustomerWhere({
    exportStatus: snap.exportStatus || "all",
    q: snap.q || "",
    filterRules: Array.isArray(snap.filters) ? snap.filters : [],
  });
  const orderBy = buildCustomerOrderBy(
    snap.sortField || "",
    snap.sortDir === "desc" ? "desc" : "asc"
  );

  await updateJobProgress(prisma, queueJobId, {
    status: "processing",
    message: "查詢匯出資料中…",
    progressTotal: 3,
    progressDone: 1,
    startedAt: new Date(),
  });

  const rows = await prisma.customer.findMany({
    where,
    orderBy,
    take: MAX_EXPORT_ROWS + 1,
  });
  if (rows.length > MAX_EXPORT_ROWS) {
    await updateJobProgress(prisma, queueJobId, {
      status: "failed",
      error: "too_many_rows",
      message: `匯出筆數超過上限 ${MAX_EXPORT_ROWS}`,
      finishedAt: new Date(),
    });
    return;
  }

  let visibleKeys: string[] = Array.isArray(snap.visibleFieldKeys)
    ? snap.visibleFieldKeys.map((k) => String(k || "").trim()).filter(Boolean)
    : [];
  if (visibleKeys.length === 0) {
    const visibleDefs: Array<{ key: string }> = await prisma.fieldDefinition.findMany({
      where: { defaultVisible: true, isExportable: true },
      orderBy: { sortOrder: "asc" },
      select: { key: true },
    });
    visibleKeys = visibleDefs.map((d: { key: string }) => d.key);
  }

  const defs: Array<{ key: string; name: string; isExportable: boolean }> =
    await prisma.fieldDefinition.findMany({
      where: { key: { in: visibleKeys } },
      select: { key: true, name: true, isExportable: true },
    });
  const keyToName = new Map(defs.map((d: { key: string; name: string }) => [d.key, d.name]));
  const exportKeys = visibleKeys.filter((k) => {
    const d = defs.find((x: { key: string; isExportable: boolean }) => x.key === k);
    return d ? d.isExportable !== false : true;
  });

  const promotedDefs = await prisma.fieldDefinition.findMany({
    where: {
      key: { in: exportKeys },
      storageMode: "promoted",
      promotionStatus: "applied",
    },
    select: { key: true },
  });
  const customerColumnSet = await loadCustomerColumnNames(prisma);
  const promotedExportKeys = promotedDefs
    .map((d: { key: string }) => String(d.key || "").trim())
    .filter((key) => key && customerColumnSet.has(toPromotedColumnName(key)));

  await updateJobProgress(prisma, queueJobId, {
    status: "processing",
    message: "產生匯出檔中…",
    progressTotal: 3,
    progressDone: 2,
  });

  const exportDir = path.join(process.cwd(), "uploads", "exports");
  fs.mkdirSync(exportDir, { recursive: true });
  const headerLine = exportKeys.map((k) => csvEscape(String(keyToName.get(k) || k))).join(",");
  const dtos = rows.map(toDTO);

  const promotedValuesByCuid = new Map<string, Record<string, unknown>>();
  if (promotedExportKeys.length > 0 && rows.length > 0) {
    const selectCols = promotedExportKeys
      .map((key) => `${quoteIdentifier(toPromotedColumnName(key))} AS ${quoteIdentifier(key)}`)
      .join(", ");
    const cuidList = rows.map((r: CustomerRow) => `'${String(r.cuid).replace(/'/g, "''")}'`).join(", ");
    const sql = `SELECT "cuid", ${selectCols} FROM "Customer" WHERE "cuid" IN (${cuidList})`;
    const rawRows = (await prisma.$queryRawUnsafe(sql)) as Array<Record<string, unknown>>;
    for (const item of rawRows) {
      const cuid = String(item.cuid || "");
      if (!cuid) continue;
      const slice: Record<string, unknown> = {};
      for (const key of promotedExportKeys) {
        if (item[key] !== undefined && item[key] !== null) slice[key] = item[key];
      }
      promotedValuesByCuid.set(cuid, slice);
    }
  }

  const fileBase = `export_${Date.now()}`;
  const files: Array<{
    fileName: string;
    filePath: string;
    rowCount: number;
    part: number;
  }> = [];
  const partCount = Math.max(1, Math.ceil(dtos.length / EXPORT_PART_ROWS));
  for (let part = 0; part < partCount; part += 1) {
    const start = part * EXPORT_PART_ROWS;
    const end = start + EXPORT_PART_ROWS;
    const partRows = dtos.slice(start, end);
    const lines = [
      headerLine,
      ...partRows.map((row: CustomerDTO) => {
        const attrs =
          row.attrs && typeof row.attrs === "object" && !Array.isArray(row.attrs)
            ? (row.attrs as Record<string, unknown>)
            : {};
        return exportKeys
          .map((k) => {
            if (CORE_VALUE_KEYS.has(k as keyof CustomerDTO) && k !== "attrs") {
              return csvEscape((row as Record<string, unknown>)[k] as never);
            }
            const promotedSlice = promotedValuesByCuid.get(row.cuid);
            const fpRaw = promotedSlice?.[k];
            const fpStr = fpRaw !== undefined && fpRaw !== null ? String(fpRaw).trim() : "";
            if (fpStr !== "") return csvEscape(fpStr);
            return csvEscape(String(attrs[k] ?? ""));
          })
          .join(",");
      }),
    ];
    const partNo = String(part + 1).padStart(3, "0");
    const fileName =
      partCount === 1 ? `${fileBase}.csv` : `${fileBase}_part${partNo}.csv`;
    const filePath = path.join(exportDir, fileName);
    fs.writeFileSync(filePath, "\uFEFF" + lines.join("\r\n"), "utf8");
    files.push({ fileName, filePath, rowCount: partRows.length, part: part + 1 });
  }
  const label = new Date().toISOString().slice(0, 10);

  const exportJob = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.exportJob.create({
      data: {
        recipient,
        remarks,
        fileName: files[0]!.fileName,
        filePath: files[0]!.filePath,
        rowCount: rows.length,
        filterSnapshot: { ...snap, visibleFieldKeys: exportKeys } as object,
      },
    });
    if (rows.length > 0) {
      await tx.customerExportMark.createMany({
        data: rows.map((r: CustomerRow) => ({
          exportJobId: created.id,
          cuid: r.cuid,
        })),
      });
      await tx.customer.updateMany({
        where: { cuid: { in: rows.map((r: CustomerRow) => r.cuid) } },
        data: {
          exportRecord: label,
          recipient,
        },
      });
    }
    return created;
  });

  await updateJobProgress(prisma, queueJobId, {
    status: "completed",
    message: "匯出完成",
    progressTotal: 3,
    progressDone: 3,
    result: {
      exportId: String(exportJob.id),
      fileName: files[0]!.fileName,
      rowCount: rows.length,
      recipient,
      files: files.map((x) => ({
        fileName: x.fileName,
        rowCount: x.rowCount,
        part: x.part,
      })),
    },
    finishedAt: new Date(),
  });
}
