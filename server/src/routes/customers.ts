import type { Express } from "express";
import type { Prisma, PrismaClient } from "@prisma/client";
import { toDTO, toListDTO } from "../lib/customerMapper.js";
import {
  CUSTOMER_SORTABLE,
  FILTERABLE_FIELD_KEYS,
  QUERY_SORT_WHITELIST,
  allowsApproximateListTotal,
  buildCustomerOrderBy,
  buildCustomerWhere,
  isFilterFieldAllowed,
  shouldSkipExpensiveListCount,
  type ListQueryInput,
} from "../lib/customerWhere.js";
import { getApproximateCustomerRowCount } from "../lib/pgApproximateCount.js";
import { writeAuditLog } from "../lib/auditLog.js";
import { toolError } from "../lib/toolError.js";
import { enqueueJob } from "../lib/jobQueue.js";
import { runCleanInvalidQueueJob } from "../lib/cleanInvalidJobRunner.js";
import {
  expectedNationalLengths,
  isValidPhoneByCountry,
  normalizePhoneDigits,
  toNationalDigits,
} from "../lib/phoneCountryRules.js";
import { quoteIdentifier, toPromotedColumnName } from "../lib/fieldPromotionSql.js";
import {
  applyPromotedFpValuesForCuids,
  loadPromotedWritableColumns,
  stripPromotedKeysToFpValues,
  syncPromotedColumnsForCuids,
} from "../lib/promotedSync.js";

const PATCHABLE: (keyof Prisma.CustomerUpdateInput)[] = [
  "name",
  "englishName",
  "age",
  "birthDate",
  "position",
  "salary",
  "email",
  "department",
  "provider",
  "recipient",
  "isError",
  "importRecord",
  "exportRecord",
  "attrs",
];

function slugKey(input: string): string {
  const s = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s || "remark";
}

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

function completenessScore(row: Record<string, unknown>): number {
  const keys = [
    "name",
    "englishName",
    "phone",
    "email",
    "department",
    "position",
    "birthDate",
    "provider",
    "recipient",
  ];
  let score = 0;
  for (const k of keys) {
    if (!isEmptyValue(row[k])) score += 1;
  }
  return score;
}

type CleanInvalidRule = "phone_empty" | "email_invalid" | "phone_country_invalid";
type CleanInvalidMode = "quarantine" | "delete";
const CLEAN_INVALID_SELECTED_CHUNK = 5000;

function isValidEmail(email: string): boolean {
  const s = String(email || "").trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function classifyPhoneLengthReason(country: string, phone: string): string | null {
  const normalized = normalizePhoneDigits(phone);
  if (!normalized) return "phone_empty";
  const national = toNationalDigits(country, normalized);
  const expected = expectedNationalLengths(country);
  const nearest = expected.reduce((best, cur) =>
    Math.abs(cur - national.length) < Math.abs(best - national.length) ? cur : best,
  expected[0] || 10);
  const delta = national.length - nearest;
  if (delta === 1) return "phone_extra_1";
  if (delta >= 2) return "phone_extra_2";
  if (delta === -1) return "phone_short_1";
  if (delta <= -2) return "phone_short_2";
  return null;
}

function normalizeCleanRules(rules: unknown): CleanInvalidRule[] {
  const allowed: CleanInvalidRule[] = ["phone_empty", "email_invalid", "phone_country_invalid"];
  const list = Array.isArray(rules)
    ? rules.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const picked = list.filter((x): x is CleanInvalidRule => allowed.includes(x as CleanInvalidRule));
  return picked.length ? [...new Set(picked)] : ["phone_empty"];
}

function splitIntoChunks<T>(items: T[], chunkSize: number): T[][] {
  if (items.length <= chunkSize) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) out.push(items.slice(i, i + chunkSize));
  return out;
}

function isAlreadyQuarantinedByCleanInvalid(
  row: { isError?: boolean; attrs?: unknown } | null | undefined
): boolean {
  if (!row) return false;
  if (!row.isError) return false;
  const attrs =
    row.attrs && typeof row.attrs === "object" && !Array.isArray(row.attrs)
      ? (row.attrs as Record<string, unknown>)
      : null;
  return String(attrs?.__quarantineSource || "") === "clean-invalid";
}

function chunkItems<T>(items: T[], chunkSize: number): T[][] {
  if (items.length <= chunkSize) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) out.push(items.slice(i, i + chunkSize));
  return out;
}

function sqlLiteral(input: unknown): string {
  return `'${String(input ?? "").replace(/'/g, "''")}'`;
}

async function loadExistingCustomerColumns(prisma: PrismaClient): Promise<Set<string>> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Customer'`
  )) as Array<{ column_name?: string }>;
  return new Set(rows.map((r) => String(r.column_name || "").trim()).filter(Boolean));
}

/** Keyset cursor：排序鍵為 NULL 時使用（JSON 內不可與真實字串衝突） */
const CURSOR_NULL_SORT_MARKER = "__crm_keyset_null_sort__";

export function registerCustomers(app: Express, prisma: PrismaClient) {
  const useExternalWorker = process.env.JOB_EXECUTION_MODE === "worker";
  const remarkEventRepo = (prisma as any).remarkEvent;
  const fieldDefinitionRepo = (prisma as any).fieldDefinition;
  let customersMetaCache:
    | {
        countries: string[];
        providers: string[];
        expiresAt: number;
      }
    | null = null;
  type CursorToken =
    | { lastCuid: string; nullSort: true }
    | { lastCuid: string; nullSort?: false; lastValue: string | number };
  const DEFAULT_SORT_FIELD = "updatedAt";
  const META_CACHE_MS = 5 * 60 * 1000;

  function encodeCursor(input: CursorToken): string {
    const payload =
      "nullSort" in input && input.nullSort
        ? { lastCuid: input.lastCuid, lastValue: CURSOR_NULL_SORT_MARKER }
        : { lastCuid: input.lastCuid, lastValue: (input as { lastValue: string | number }).lastValue };
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  }

  function decodeCursor(token: string): CursorToken | null {
    try {
      const raw = Buffer.from(token, "base64url").toString("utf8");
      const parsed = JSON.parse(raw) as { lastCuid?: string; lastValue?: unknown };
      if (!parsed || !parsed.lastCuid) return null;
      if (parsed.lastValue === CURSOR_NULL_SORT_MARKER) {
        return { lastCuid: String(parsed.lastCuid), nullSort: true as const };
      }
      if (parsed.lastValue === undefined || parsed.lastValue === null) return null;
      return {
        lastCuid: String(parsed.lastCuid),
        nullSort: false,
        lastValue: parsed.lastValue as string | number,
      };
    } catch {
      return null;
    }
  }

  app.get("/api/customers/query-contract", (_req, res) => {
    res.json({
      pagination: {
        mode: "keyset",
        defaultPageSize: 50,
        maxPageSize: 200,
        cursorField: "cursor",
        nextCursorField: "nextCursor",
      },
      sorting: {
        defaultField: DEFAULT_SORT_FIELD,
        defaultDirection: "desc",
        allowedFields: QUERY_SORT_WHITELIST,
      },
      filters: {
        allowedFields: FILTERABLE_FIELD_KEYS,
        operators: ["等於", "不等於", "包含", "不包含", "大於", "小於"],
      },
    });
  });

  app.get("/api/customers/meta", async (_req, res) => {
    if (customersMetaCache && customersMetaCache.expiresAt > Date.now()) {
      return res.json({
        countries: customersMetaCache.countries,
        providers: customersMetaCache.providers,
        cached: true,
      });
    }
    const [countries, providers] = await prisma.$transaction([
      prisma.customer.findMany({ select: { country: true }, distinct: ["country"] }),
      prisma.customer.findMany({ select: { provider: true }, distinct: ["provider"] }),
    ]);
    const payload = {
      countries: countries.map((c) => c.country).sort(),
      providers: providers.map((p) => p.provider).sort(),
    };
    customersMetaCache = { ...payload, expiresAt: Date.now() + META_CACHE_MS };
    res.json(payload);
  });

  app.get("/api/customers", async (req, res) => {
    const queryStartedAt = Date.now();
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 20));
    const exportStatus = String(req.query.exportStatus || "all");
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const providerExact =
      typeof req.query.provider === "string" ? req.query.provider.trim() : "";
    const countryExact =
      typeof req.query.country === "string" ? req.query.country.trim() : "";
    const sortFieldRaw =
      typeof req.query.sortField === "string" && req.query.sortField
        ? req.query.sortField
        : DEFAULT_SORT_FIELD;
    const sortDir = req.query.sortDir === "desc" ? "desc" : "asc";
    const cursorToken = typeof req.query.cursor === "string" ? req.query.cursor : "";
    if (req.query.paginationMode === "offset" || req.query.cap !== undefined || req.query.sampleMode !== undefined) {
      return res.status(400).json({
        error: "keyset_only_mode",
        message: "customers endpoint now supports keyset pagination only",
      });
    }

    let filterRules: Array<{ field: string; operator: string; value: string }> = [];
    if (typeof req.query.filters === "string" && req.query.filters) {
      try {
        const parsed = JSON.parse(req.query.filters) as unknown;
        if (Array.isArray(parsed)) filterRules = parsed as typeof filterRules;
      } catch {
        /* ignore */
      }
    }
    const invalidFilterField = filterRules.find((x) => !isFilterFieldAllowed(String(x.field || "")));
    if (invalidFilterField) {
      return res.status(400).json({ error: "unsupported_filter_field", field: invalidFilterField.field });
    }
    let visibleFieldKeys: string[] = [];
    if (typeof req.query.visibleFieldKeys === "string" && req.query.visibleFieldKeys) {
      try {
        const parsed = JSON.parse(req.query.visibleFieldKeys) as unknown;
        if (Array.isArray(parsed)) {
          visibleFieldKeys = [...new Set(parsed.map((x) => String(x || "").trim()).filter(Boolean))];
        }
      } catch {
        /* ignore */
      }
    }
    const existingCustomerColumns = await loadExistingCustomerColumns(prisma);
    const visibleAttrKeys = visibleFieldKeys.filter((fieldKey) => !FILTERABLE_FIELD_KEYS.includes(fieldKey));
    const promotedVisibleDefs: Array<{ key: string }> =
      visibleAttrKeys.length > 0
        ? await fieldDefinitionRepo.findMany({
            where: {
              key: { in: visibleAttrKeys },
              storageMode: "promoted",
              promotionStatus: "applied",
            },
            select: { key: true },
          })
        : [];
    const promotedVisibleKeys = new Set<string>(
      promotedVisibleDefs
        .map((x) => String(x.key || "").trim())
        .filter((key) => key && existingCustomerColumns.has(toPromotedColumnName(key)))
    );
    const attrsVisibleKeys = visibleAttrKeys.filter((key) => !promotedVisibleKeys.has(key));
    const sortField = CUSTOMER_SORTABLE[sortFieldRaw] ? sortFieldRaw : "cuid";
    const dynamicFilterKeys = filterRules
      .map((r) => String(r.field || "").trim())
      .filter((key) => key && !FILTERABLE_FIELD_KEYS.includes(key));
    const promotedFilterSortCandidates = [
      ...new Set([
        ...dynamicFilterKeys,
        ...(FILTERABLE_FIELD_KEYS.includes(sortFieldRaw) ? [] : [sortFieldRaw]),
      ]),
    ];
    const promotedFilterSortDefs: Array<{ key: string }> =
      promotedFilterSortCandidates.length > 0
        ? await fieldDefinitionRepo.findMany({
            where: {
              key: { in: promotedFilterSortCandidates },
              storageMode: "promoted",
              promotionStatus: "applied",
            },
            select: { key: true },
          })
        : [];
    const promotedFilterSortSet = new Set(
      promotedFilterSortDefs
        .map((x) => String(x.key || "").trim())
        .filter((key) => key && existingCustomerColumns.has(toPromotedColumnName(key)))
    );

    const listInput: ListQueryInput = {
      exportStatus,
      q,
      providerExact,
      countryExact,
      filterRules,
    };
    const where = buildCustomerWhere(listInput);
    const exactTotal =
      req.query.exactTotal === "1" || String(req.query.exactTotal || "").toLowerCase() === "true";
    let total: number | null = 0;
    let totalApproximate = false;
    let totalSkipped = false;
    const decodedCursor = cursorToken ? decodeCursor(cursorToken) : null;
    if (cursorToken && !decodedCursor) {
      return res.status(400).json({ error: "invalid_cursor" });
    }
    const sortColumn = CUSTOMER_SORTABLE[sortField] || "cuid";
    const promotedSortKey = promotedFilterSortSet.has(sortFieldRaw) ? sortFieldRaw : "";
    const hasPromotedInFilter = filterRules.some((r) => promotedFilterSortSet.has(String(r.field || "").trim()));
    const hasNonPromotedDynamicFilter = filterRules.some((r) => {
      const key = String(r.field || "").trim();
      if (!key || FILTERABLE_FIELD_KEYS.includes(key)) return false;
      return !promotedFilterSortSet.has(key);
    });
    const usePromotedSqlPath =
      (Boolean(promotedSortKey) || hasPromotedInFilter) && !hasNonPromotedDynamicFilter;
    const queryMode = usePromotedSqlPath ? "promoted-sql-keyset" : "prisma-keyset";
    const valueCursorWhere: Prisma.CustomerWhereInput | null =
      decodedCursor === null
        ? null
        : decodedCursor.nullSort
          ? sortDir === "desc"
            ? ({
                OR: [
                  { AND: [{ [sortColumn]: null }, { cuid: { gt: decodedCursor.lastCuid } }] },
                  { NOT: { [sortColumn]: null } },
                ],
              } as Prisma.CustomerWhereInput)
            : ({
                AND: [{ [sortColumn]: null }, { cuid: { gt: decodedCursor.lastCuid } }],
              } as Prisma.CustomerWhereInput)
          : sortDir === "asc"
            ? {
                OR: [
                  { [sortColumn]: { gt: decodedCursor.lastValue } },
                  { [sortColumn]: decodedCursor.lastValue, cuid: { gt: decodedCursor.lastCuid } },
                  { [sortColumn]: null },
                ],
              }
            : {
                OR: [
                  { [sortColumn]: { lt: decodedCursor.lastValue } },
                  { [sortColumn]: decodedCursor.lastValue, cuid: { gt: decodedCursor.lastCuid } },
                ],
              };
    const cursorWhere = valueCursorWhere ? { AND: [where, valueCursorWhere] } : where;
    const baseSelect: Prisma.CustomerSelect = {
      cuid: true,
      country: true,
      provider: true,
      phone: true,
      name: true,
      englishName: true,
      age: true,
      birthDate: true,
      position: true,
      salary: true,
      email: true,
      department: true,
      importRecord: true,
      exportRecord: true,
      recipient: true,
      isError: true,
      ...(attrsVisibleKeys.length > 0 || promotedVisibleKeys.size > 0 ? { attrs: true } : {}),
      ...(sortColumn === "updatedAt" ? { updatedAt: true } : {}),
    };
    const rowsPromise = prisma.customer.findMany({
      where: cursorWhere,
      select: baseSelect,
      orderBy: buildCustomerOrderBy(sortField, sortDir),
      take: pageSize + 1,
    });

    let rows: Awaited<typeof rowsPromise>;
    if (usePromotedSqlPath) {
      const promotedExprByKey = new Map<string, string>(
        [...promotedFilterSortSet].map((key) => [key, `c.${quoteIdentifier(toPromotedColumnName(key))}`])
      );
      const coreExpr = (key: string): string => `c.${quoteIdentifier(CUSTOMER_SORTABLE[key] || "cuid")}`;
      const exprByField = (field: string): string =>
        FILTERABLE_FIELD_KEYS.includes(field)
          ? coreExpr(field)
          : promotedExprByKey.get(field) || `c."attrs"->>${sqlLiteral(field)}`;
      const whereSql: string[] = [];
      if (providerExact) whereSql.push(`c."provider" = ${sqlLiteral(providerExact)}`);
      if (countryExact) whereSql.push(`c."country" = ${sqlLiteral(countryExact)}`);
      if (exportStatus === "exported") whereSql.push(`c."exportRecord" <> ''`);
      if (exportStatus === "not-exported") whereSql.push(`c."exportRecord" = ''`);
      if (q) {
        const qDigits = normalizePhoneDigits(q);
        const qLike = `${String(q).replace(/'/g, "''")}%`;
        const orParts = [
          `c."cuid" ILIKE ${sqlLiteral(qLike)}`,
          `c."name" ILIKE ${sqlLiteral(qLike)}`,
          `c."englishName" ILIKE ${sqlLiteral(qLike)}`,
          `c."country" ILIKE ${sqlLiteral(qLike)}`,
          `c."provider" ILIKE ${sqlLiteral(qLike)}`,
          `c."department" ILIKE ${sqlLiteral(qLike)}`,
        ];
        if (qDigits) orParts.push(`c."phoneNormalized" LIKE ${sqlLiteral(`${qDigits}%`)}`);
        whereSql.push(`(${orParts.join(" OR ")})`);
      }
      for (const rule of filterRules) {
        const field = String(rule.field || "").trim();
        const value = String(rule.value || "").trim();
        if (!field || !value) continue;
        const expr = exprByField(field);
        if (rule.operator === "等於") whereSql.push(`${expr} ILIKE ${sqlLiteral(value)}`);
        if (rule.operator === "不等於") whereSql.push(`NOT (${expr} ILIKE ${sqlLiteral(value)})`);
        if (rule.operator === "包含") whereSql.push(`${expr} ILIKE ${sqlLiteral(`%${value}%`)}`);
        if (rule.operator === "不包含")
          whereSql.push(`NOT (${expr} ILIKE ${sqlLiteral(`%${value}%`)})`);
      }
      const whereClause = whereSql.length > 0 ? `WHERE ${whereSql.join(" AND ")}` : "";
      const sortExpr = promotedSortKey ? exprByField(promotedSortKey) : coreExpr(sortField);
      const cursorClause =
        decodedCursor === null
          ? ""
          : decodedCursor.nullSort
            ? sortDir === "desc"
              ? `AND ((${sortExpr} IS NULL AND c."cuid" > ${sqlLiteral(decodedCursor.lastCuid)}) OR (${sortExpr} IS NOT NULL))`
              : `AND (${sortExpr} IS NULL AND c."cuid" > ${sqlLiteral(decodedCursor.lastCuid)})`
            : sortDir === "asc"
              ? `AND ((${sortExpr} > ${sqlLiteral(decodedCursor.lastValue)}) OR (${sortExpr} = ${sqlLiteral(decodedCursor.lastValue)} AND c."cuid" > ${sqlLiteral(decodedCursor.lastCuid)}) OR (${sortExpr} IS NULL))`
              : `AND ((${sortExpr} < ${sqlLiteral(decodedCursor.lastValue)}) OR (${sortExpr} = ${sqlLiteral(decodedCursor.lastValue)} AND c."cuid" > ${sqlLiteral(decodedCursor.lastCuid)}))`;
      const sqlRows = `SELECT c."cuid", c."country", c."provider", c."phone", c."name", c."englishName", c."age", c."birthDate", c."position", c."salary", c."email", c."department", c."importRecord", c."exportRecord", c."recipient", c."isError", c."attrs", ${sortExpr} AS "__sortValue"
        FROM "Customer" c
        ${whereClause}
        ${cursorClause ? (whereClause ? cursorClause : `WHERE ${cursorClause.slice(4)}`) : ""}
        ORDER BY ${sortExpr} ${sortDir.toUpperCase()}, c."cuid" ASC
        LIMIT ${pageSize + 1}`;
      rows = (await prisma.$queryRawUnsafe(sqlRows)) as Awaited<typeof rowsPromise>;
      if (exactTotal) {
        const countSql = `SELECT COUNT(*)::bigint AS n FROM "Customer" c ${whereClause}`;
        const countRows = (await prisma.$queryRawUnsafe(countSql)) as Array<{ n: bigint | number | string }>;
        total = Number(countRows[0]?.n || 0);
      } else if (shouldSkipExpensiveListCount(listInput)) {
        total = null;
        totalSkipped = true;
      } else {
        const countSql = `SELECT COUNT(*)::bigint AS n FROM "Customer" c ${whereClause}`;
        const countRows = (await prisma.$queryRawUnsafe(countSql)) as Array<{ n: bigint | number | string }>;
        total = Number(countRows[0]?.n || 0);
      }
      totalApproximate = false;
    } else if (exactTotal) {
      const [pageRows, countVal] = await Promise.all([rowsPromise, prisma.customer.count({ where })]);
      rows = pageRows;
      total = countVal;
    } else if (allowsApproximateListTotal(listInput)) {
      const [pageRows, approx] = await Promise.all([rowsPromise, getApproximateCustomerRowCount(prisma)]);
      rows = pageRows;
      if (approx !== null) {
        total = approx;
        totalApproximate = true;
      } else {
        total = await prisma.customer.count({ where });
      }
    } else if (shouldSkipExpensiveListCount(listInput)) {
      rows = await rowsPromise;
      total = null;
      totalSkipped = true;
    } else {
      const [pageRows, countVal] = await Promise.all([rowsPromise, prisma.customer.count({ where })]);
      rows = pageRows;
      total = countVal;
    }
    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    const last = pageRows[pageRows.length - 1];
    const sortValue = last
      ? (last as Record<string, unknown>).__sortValue ??
        (last as Record<string, unknown>)[sortColumn]
      : null;
    const nextCursor =
      hasMore && last
        ? sortValue === null || sortValue === undefined
          ? encodeCursor({ nullSort: true, lastCuid: last.cuid })
          : encodeCursor({ lastValue: sortValue as string | number, lastCuid: last.cuid })
        : null;
    const promotedValueByCuid =
      promotedVisibleKeys.size > 0 && pageRows.length > 0
        ? await (async () => {
            const promotedList = [...promotedVisibleKeys];
            const selectCols = promotedList
              .map((key) => {
                const col = toPromotedColumnName(key);
                return `${quoteIdentifier(col)} AS ${quoteIdentifier(key)}`;
              })
              .join(", ");
            const cuidVals = pageRows.map((row) => `'${String(row.cuid).replace(/'/g, "''")}'`).join(", ");
            const sql = `SELECT "cuid", ${selectCols} FROM "Customer" WHERE "cuid" IN (${cuidVals})`;
            const rowsRaw = (await prisma.$queryRawUnsafe(sql)) as Array<Record<string, unknown>>;
            const byCuid = new Map<string, Record<string, unknown>>();
            for (const item of rowsRaw) {
              const cuid = String(item.cuid || "");
              if (!cuid) continue;
              const attrsFromPromoted: Record<string, unknown> = {};
              for (const key of promotedList) {
                if (item[key] !== undefined && item[key] !== null) attrsFromPromoted[key] = item[key];
              }
              byCuid.set(cuid, attrsFromPromoted);
            }
            return byCuid;
          })()
        : new Map<string, Record<string, unknown>>();
    const queryElapsedMs = Date.now() - queryStartedAt;
    console.log(
      `[customers.list] mode=${queryMode} elapsedMs=${queryElapsedMs} pageSize=${pageSize} q=${q ? "1" : "0"} filters=${filterRules.length}`
    );
    return res.json({
      items: pageRows.map((row) => {
        const base = toListDTO(row, attrsVisibleKeys);
        const rowAttrs =
          row.attrs && typeof row.attrs === "object" && !Array.isArray(row.attrs)
            ? (row.attrs as Record<string, unknown>)
            : {};
        const promotedAttrs = promotedValueByCuid.get(String(row.cuid)) || {};
        const mergedAttrs: Record<string, unknown> = { ...(base.attrs || {}) };
        for (const key of promotedVisibleKeys) {
          const fpRaw = promotedAttrs[key];
          const fpStr = fpRaw !== undefined && fpRaw !== null ? String(fpRaw).trim() : "";
          if (fpStr !== "") mergedAttrs[key] = fpRaw;
          else if (Object.prototype.hasOwnProperty.call(rowAttrs, key)) mergedAttrs[key] = rowAttrs[key];
        }
        return {
          ...base,
          attrs: mergedAttrs,
        };
      }),
      total,
      totalApproximate,
      totalSkipped,
      page: 1,
      pageSize,
      mode: "keyset",
      cursor: cursorToken || null,
      nextCursor,
      hasMore,
      queryMode,
      queryElapsedMs,
    });
  });

  app.patch("/api/customers/:cuid", async (req, res) => {
    const { cuid } = req.params;
    const body = req.body as Record<string, unknown>;
    const data: Prisma.CustomerUpdateInput = {};
    for (const key of PATCHABLE) {
      if (key in body && body[key] !== undefined) {
        (data as Record<string, unknown>)[key] = body[key];
      }
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "no_valid_fields" });
    }
    try {
      const hadAttrsUpdate =
        data.attrs && typeof data.attrs === "object" && !Array.isArray(data.attrs);
      let fpApply: Array<{ cuid: string; fpValues: Record<string, string> }> | null = null;
      if (hadAttrsUpdate) {
        const pw = await loadPromotedWritableColumns(prisma);
        const { attrs, fpValues } = stripPromotedKeysToFpValues(
          data.attrs as Record<string, unknown>,
          pw
        );
        (data as Record<string, unknown>).attrs = attrs;
        if (Object.keys(fpValues).length > 0) fpApply = [{ cuid, fpValues }];
      }
      const row = await prisma.customer.update({
        where: { cuid },
        data,
      });
      if (fpApply?.length) await applyPromotedFpValuesForCuids(prisma, fpApply);
      if (hadAttrsUpdate) {
        await syncPromotedColumnsForCuids(prisma, [cuid]);
      }
      await writeAuditLog({
        action: "customer.patch",
        targetType: "customer",
        targetId: cuid,
        detail: { fields: Object.keys(data) },
      });
      res.json(toDTO(row));
    } catch {
      res.status(404).json({ error: "not_found" });
    }
  });

  app.delete("/api/customers/:cuid", async (req, res) => {
    const { cuid } = req.params;
    try {
      await prisma.customer.delete({ where: { cuid } });
      await writeAuditLog({
        action: "customer.delete",
        targetType: "customer",
        targetId: cuid,
      });
      res.status(204).send();
    } catch {
      res.status(404).json({ error: "not_found" });
    }
  });

  app.post("/api/customers/bulk-delete", async (req, res) => {
    const cuids = (req.body as { cuids?: string[] })?.cuids;
    if (!Array.isArray(cuids) || cuids.length === 0) {
      return res.status(400).json({ error: "cuids_required" });
    }
    const result = await prisma.customer.deleteMany({
      where: { cuid: { in: cuids } },
    });
    await writeAuditLog({
      action: "customer.bulk-delete",
      targetType: "customer",
      detail: { requested: cuids.length, deleted: result.count },
    });
    res.json({ deleted: result.count });
  });

  app.post("/api/customers/bulk-delete-by-filter", async (req, res) => {
    const body = req.body as {
      filterSnapshot?: {
        q?: string;
        exportStatus?: string;
        providerExact?: string;
        countryExact?: string;
        filters?: Array<{ field: string; operator: string; value: string }>;
      };
    };
    const snap = body.filterSnapshot || {};
    const where = buildCustomerWhere({
      exportStatus: String(snap.exportStatus || "all"),
      q: String(snap.q || ""),
      providerExact: String((snap as any).providerExact || "").trim(),
      countryExact: String((snap as any).countryExact || "").trim(),
      filterRules: Array.isArray(snap.filters) ? snap.filters : [],
    });
    const deleted = await prisma.customer.deleteMany({ where });
    await writeAuditLog({
      action: "customer.bulk-delete-by-filter",
      targetType: "customer",
      detail: {
        deleted: deleted.count,
        q: String(snap.q || ""),
        exportStatus: String(snap.exportStatus || "all"),
        filters: Array.isArray(snap.filters) ? snap.filters : [],
      },
    });
    return res.json({ deleted: Number(deleted.count || 0) });
  });

  app.post("/api/customers/add-remarks", async (req, res) => {
    const body = req.body as {
      target?: "selected" | "filtered" | "all";
      cuids?: string[];
      filterSnapshot?: {
        q?: string;
        exportStatus?: string;
        filters?: Array<{ field: string; operator: string; value: string }>;
      };
      fieldName?: string;
      fieldKey?: string;
      remarkContent?: string;
    };

    const target = body.target || "filtered";
    const fieldName = String(body.fieldName || "備註").trim() || "備註";
    const requestedKey = String(body.fieldKey || "").trim();
    const fieldKey = slugKey(requestedKey || fieldName);
    const value =
      String(body.remarkContent || "").trim() || `${new Date().toISOString()} via add-remarks`;

    let targetCuids: string[] = [];
    if (target === "selected") {
      const cuids = Array.isArray(body.cuids) ? body.cuids.map((x) => String(x)) : [];
      targetCuids = [...new Set(cuids.filter(Boolean))];
      if (!targetCuids.length) {
        return res
          .status(400)
          .json(toolError("selected_required", "請先勾選資料再執行此工具"));
      }
    } else {
      const snap = body.filterSnapshot || {};
      const where =
        target === "all"
          ? {}
          : buildCustomerWhere({
              exportStatus: String(snap.exportStatus || "all"),
              q: String(snap.q || ""),
              filterRules: Array.isArray(snap.filters) ? snap.filters : [],
            });
      const rows = await prisma.customer.findMany({
        where,
        select: { cuid: true },
        take: 200_000,
      });
      targetCuids = rows.map((r) => r.cuid);
    }

    if (!targetCuids.length) return res.json({ updated: 0, fieldKey });

    const promotedWritable = await loadPromotedWritableColumns(prisma);

    await prisma.$transaction(async (tx: any) => {
      const exists = await tx.fieldDefinition.findUnique({ where: { key: fieldKey } });
      if (!exists) {
        const maxSort = await tx.fieldDefinition.aggregate({ _max: { sortOrder: true } });
        await tx.fieldDefinition.create({
          data: {
            key: fieldKey,
            name: fieldName,
            uiColor: "bg-gray-500",
            type: "文字",
            category: "",
            aliases: [fieldName],
            source: "manual",
            isRequired: false,
            isSystem: false,
            defaultVisible: true,
            isExportable: true,
            sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
            groupId: null,
          },
        });
      }

      const rows = await tx.customer.findMany({
        where: { cuid: { in: targetCuids } },
        select: { cuid: true, attrs: true },
      });
      const now = new Date();
      const fpBatch: Array<{ cuid: string; fpValues: Record<string, string> }> = [];
      for (const row of rows) {
        const attrs =
          row.attrs && typeof row.attrs === "object" && !Array.isArray(row.attrs)
            ? { ...(row.attrs as Record<string, unknown>) }
            : {};
        attrs[fieldKey] = value;
        const { attrs: cleanAttrs, fpValues } = stripPromotedKeysToFpValues(attrs, promotedWritable);
        if (Object.keys(fpValues).length > 0) fpBatch.push({ cuid: row.cuid, fpValues });
        await tx.remarkEvent.create({
          data: {
            cuid: row.cuid,
            fieldKey,
            fieldName,
            value,
            operator: "set",
            actor: "system",
            createdAt: now,
          },
        });
        await tx.customer.update({
          where: { cuid: row.cuid },
          data: {
            attrs: cleanAttrs as Prisma.InputJsonValue,
            remarkLatest: value,
            remarkUpdatedAt: now,
          },
        });
      }
      if (fpBatch.length) {
        await applyPromotedFpValuesForCuids(tx as PrismaClient, fpBatch);
      }
    });
    await syncPromotedColumnsForCuids(prisma, targetCuids);

    await writeAuditLog({
      action: "customer.add-remarks",
      targetType: "customer",
      detail: { target, updated: targetCuids.length, fieldKey },
    });
    res.json({ updated: targetCuids.length, fieldKey, fieldName });
  });

  app.get("/api/customers/:cuid/remarks", async (req, res) => {
    const cuid = String(req.params.cuid || "");
    if (!cuid) return res.status(400).json({ error: "cuid_required" });
    const limitRaw = Number(req.query.limit ?? 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(1000, Math.max(1, Math.floor(limitRaw))) : 100;
    const rows = await remarkEventRepo.findMany({
      where: { cuid },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json({
      items: rows.map((x: any) => ({
        id: String(x.id),
        cuid: String(x.cuid),
        fieldKey: String(x.fieldKey),
        fieldName: String(x.fieldName),
        value: String(x.value),
        operator: String(x.operator || "set"),
        actor: String(x.actor || "system"),
        createdAt: new Date(x.createdAt).toISOString(),
      })),
    });
  });

  app.post("/api/jobs/merge-duplicates", async (req, res) => {
    const body = req.body as {
      keepStrategy?: "keep-latest-updated" | "keep-oldest-created" | "keep-most-complete";
      fieldStrategy?: "merge-fill-empty" | "merge-latest-wins";
    };
    const keepStrategy = body.keepStrategy || "keep-latest-updated";
    const fieldStrategy = body.fieldStrategy || "merge-fill-empty";

    const groups = await prisma.customer.groupBy({
      by: ["country", "phoneNormalized"],
      _count: { _all: true },
      having: { phoneNormalized: { _count: { gt: 1 } } },
    });

    let mergedGroups = 0;
    let deletedRows = 0;
    const mergedKeeperCuids: string[] = [];
    const promotedWritable = await loadPromotedWritableColumns(prisma);
    const fpApplyRows: Array<{ cuid: string; fpValues: Record<string, string> }> = [];

    await prisma.$transaction(async (tx: any) => {
      for (const g of groups) {
        const rows = await tx.customer.findMany({
          where: { country: g.country, phoneNormalized: g.phoneNormalized },
        });
        if (rows.length <= 1) continue;

        let keeper = rows[0];
        if (keepStrategy === "keep-latest-updated") {
          keeper = [...rows].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))[0];
        } else if (keepStrategy === "keep-oldest-created") {
          keeper = [...rows].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))[0];
        } else {
          keeper = [...rows].sort((a, b) => completenessScore(b) - completenessScore(a))[0];
        }

        const donors = rows.filter((r: any) => r.cuid !== keeper.cuid);
        if (!donors.length) continue;

        const fixedKeys: Array<keyof typeof keeper> = [
          "provider",
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
        ];

        const merged: Record<string, unknown> = { ...keeper };
        for (const key of fixedKeys) {
          if (fieldStrategy === "merge-fill-empty") {
            if (isEmptyValue(merged[key as string])) {
              const donorVal = donors
                .map((d: any) => d[key as string])
                .find((v: unknown) => !isEmptyValue(v));
              if (donorVal !== undefined) merged[key as string] = donorVal;
            }
          } else {
            const donorVal = [...donors]
              .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
              .map((d: any) => d[key as string])
              .find((v: unknown) => !isEmptyValue(v));
            if (donorVal !== undefined) merged[key as string] = donorVal;
          }
        }

        const keeperAttrs =
          keeper.attrs && typeof keeper.attrs === "object" && !Array.isArray(keeper.attrs)
            ? { ...(keeper.attrs as Record<string, unknown>) }
            : {};
        for (const donor of donors) {
          const donorAttrs =
            donor.attrs && typeof donor.attrs === "object" && !Array.isArray(donor.attrs)
              ? (donor.attrs as Record<string, unknown>)
              : {};
          for (const [k, v] of Object.entries(donorAttrs)) {
            if (fieldStrategy === "merge-fill-empty") {
              if (isEmptyValue(keeperAttrs[k])) keeperAttrs[k] = v;
            } else {
              if (!isEmptyValue(v)) keeperAttrs[k] = v;
            }
          }
        }

        const { attrs: keeperAttrsForDb, fpValues } = stripPromotedKeysToFpValues(
          keeperAttrs,
          promotedWritable
        );
        if (Object.keys(fpValues).length > 0) {
          fpApplyRows.push({ cuid: String(keeper.cuid), fpValues });
        }

        await tx.customer.update({
          where: { cuid: keeper.cuid },
          data: {
            provider: String(merged.provider || ""),
            name: String(merged.name || ""),
            englishName: String(merged.englishName || ""),
            age: Number(merged.age || 0),
            birthDate: String(merged.birthDate || ""),
            position: String(merged.position || ""),
            salary: Number(merged.salary || 0),
            email: String(merged.email || ""),
            department: String(merged.department || ""),
            importRecord: String(merged.importRecord || ""),
            exportRecord: String(merged.exportRecord || ""),
            recipient: String(merged.recipient || ""),
            isError: Boolean(merged.isError),
            attrs: keeperAttrsForDb as Prisma.InputJsonValue,
          },
        });
        mergedKeeperCuids.push(String(keeper.cuid));

        await tx.customer.deleteMany({
          where: { cuid: { in: donors.map((d: any) => d.cuid) } },
        });

        mergedGroups += 1;
        deletedRows += donors.length;
      }
    });
    if (fpApplyRows.length) await applyPromotedFpValuesForCuids(prisma, fpApplyRows);
    await syncPromotedColumnsForCuids(prisma, mergedKeeperCuids);

    await writeAuditLog({
      action: "customer.merge-duplicates",
      targetType: "customer",
      detail: { keepStrategy, fieldStrategy, mergedGroups, deletedRows },
    });
    res.json({ mergedGroups, deletedRows, duplicateGroupsFound: groups.length });
  });

  app.post("/api/jobs/clean-invalid/preview", async (req, res) => {
    const body = req.body as {
      target?: "selected" | "filtered" | "all";
      cuids?: string[];
      rules?: CleanInvalidRule[];
      filterSnapshot?: {
        q?: string;
        exportStatus?: string;
        filters?: Array<{ field: string; operator: string; value: string }>;
      };
    };
    const rules = normalizeCleanRules(body.rules);
    const target = body.target || "filtered";
    const selectedCuids =
      target === "selected"
        ? [...new Set((Array.isArray(body.cuids) ? body.cuids : []).map((x) => String(x || "").trim()).filter(Boolean))]
        : [];
    const snap = body.filterSnapshot || {};
    const where: Prisma.CustomerWhereInput =
      target === "selected"
        ? { cuid: { in: selectedCuids } }
        : target === "all"
          ? {}
          : buildCustomerWhere({
              exportStatus: String(snap.exportStatus || "all"),
              q: String(snap.q || ""),
              providerExact: String((snap as any).providerExact || "").trim(),
              countryExact: String((snap as any).countryExact || "").trim(),
              filterRules: Array.isArray(snap.filters) ? snap.filters : [],
            });
    const rows: Array<{ cuid: string; country: string; phone: string; phoneNormalized: string; email: string }> = [];
    let targetRows = 0;
    if (target === "selected") {
      for (const ids of splitIntoChunks(selectedCuids, CLEAN_INVALID_SELECTED_CHUNK)) {
        const part = await prisma.customer.findMany({
          where: { cuid: { in: ids } },
          select: { cuid: true, country: true, phone: true, phoneNormalized: true, email: true, isError: true, attrs: true },
        });
        for (const item of part) {
          if (isAlreadyQuarantinedByCleanInvalid(item as any)) continue;
          rows.push(item as any);
        }
      }
      targetRows = rows.length;
    } else {
      const excludeExistingQuarantine: Prisma.CustomerWhereInput = {
        NOT: {
          AND: [
            { isError: true },
            { attrs: { path: ["__quarantineSource"], equals: "clean-invalid" } },
          ],
        },
      };
      const effectiveWhere: Prisma.CustomerWhereInput =
        Object.keys(where || {}).length === 0 ? excludeExistingQuarantine : { AND: [where, excludeExistingQuarantine] };
      targetRows = await prisma.customer.count({ where });
      if (!targetRows) {
        return res.json({ targetRows: 0, invalidRows: 0, rules, byRule: {} });
      }
      const part = await prisma.customer.findMany({
        where: effectiveWhere,
        select: { cuid: true, country: true, phone: true, phoneNormalized: true, email: true, isError: true, attrs: true },
        take: 200_000,
      });
      for (const item of part) rows.push(item);
      targetRows = rows.length;
    }
    if (!targetRows) {
      return res.json({ targetRows: 0, invalidRows: 0, rules, byRule: {} });
    }
    const byRule: Record<string, number> = {};
    const invalidCuids = new Set<string>();
    for (const row of rows) {
      const phoneEmpty = !String(row.phone || "").trim() || !String(row.phoneNormalized || "").trim();
      const emailInvalid = String(row.email || "").trim() !== "" && !isValidEmail(row.email || "");
      const phoneCountryInvalid =
        String(row.phone || "").trim() !== "" && !isValidPhoneByCountry(String(row.country || ""), String(row.phone || ""));
      const lengthReason = classifyPhoneLengthReason(String(row.country || ""), String(row.phone || ""));
      if (rules.includes("phone_empty") && phoneEmpty) {
        byRule.phone_empty = (byRule.phone_empty || 0) + 1;
        invalidCuids.add(row.cuid);
      }
      if (rules.includes("email_invalid") && emailInvalid) {
        byRule.email_invalid = (byRule.email_invalid || 0) + 1;
        invalidCuids.add(row.cuid);
      }
      if (rules.includes("phone_country_invalid") && phoneCountryInvalid) {
        const reasonKey = lengthReason || "country_phone_mismatch";
        byRule[reasonKey] = (byRule[reasonKey] || 0) + 1;
        invalidCuids.add(row.cuid);
      }
    }
    return res.json({
      targetRows,
      invalidRows: invalidCuids.size,
      rules,
      byRule,
    });
  });

  app.post("/api/jobs/clean-invalid", async (req, res) => {
    const body = req.body as {
      target?: "selected" | "filtered" | "all";
      cuids?: string[];
      rules?: CleanInvalidRule[];
      mode?: CleanInvalidMode;
      filterSnapshot?: {
        q?: string;
        exportStatus?: string;
        filters?: Array<{ field: string; operator: string; value: string }>;
      };
    };
    const rules = normalizeCleanRules(body.rules);
    const mode: CleanInvalidMode = body.mode === "delete" ? "delete" : "quarantine";
    const target = body.target || "filtered";
    const selectedCuids =
      target === "selected"
        ? [...new Set((Array.isArray(body.cuids) ? body.cuids : []).map((x) => String(x || "").trim()).filter(Boolean))]
        : [];
    const { item: queuedJob } = await enqueueJob(prisma, {
      source: "clean-invalid",
      type: "clean-invalid",
      title: mode === "delete" ? "清理無效（刪除）" : "清理無效（隔離）",
      subtitle: target === "selected" ? `已勾選 ${selectedCuids.length} 筆` : target === "all" ? "全部資料" : "目前篩選",
      payload: {
        target,
        cuids: selectedCuids,
        rules,
        mode,
        filterSnapshot: body.filterSnapshot || {},
      },
    });
    if (!useExternalWorker) {
      setImmediate(() => {
        void runCleanInvalidQueueJob(prisma, String((queuedJob as any).id));
      });
    }
    res.status(202).json({
      status: "queued",
      jobId: String((queuedJob as any).id),
      queuePosition: Number((queuedJob as any).queuePosition ?? 0),
      estimatedWaitSec: Number((queuedJob as any).estimatedWaitSec ?? 0),
      mode,
      rules,
    });
  });

  app.get("/api/customers/quarantine", async (req, res) => {
    const pageRaw = Number(req.query.page ?? 1);
    const pageSizeRaw = Number(req.query.pageSize ?? 50);
    const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;
    const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(200, Math.max(1, Math.floor(pageSizeRaw))) : 50;
    const reasonFilter = String(req.query.reason || "").trim();
    const includeLegacy = String(req.query.includeLegacy || "0") === "1";
    const baseWhere: Prisma.CustomerWhereInput = includeLegacy
      ? { isError: true }
      : {
          isError: true,
          attrs: {
            path: ["__quarantineSource"],
            equals: "clean-invalid",
          },
        };
    const rows = await prisma.customer.findMany({
      where: baseWhere,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        cuid: true,
        country: true,
        provider: true,
        phone: true,
        email: true,
        name: true,
        updatedAt: true,
        attrs: true,
      },
    });
    const items = rows
      .map((row) => {
        const attrs =
          row.attrs && typeof row.attrs === "object" && !Array.isArray(row.attrs)
            ? (row.attrs as Record<string, unknown>)
            : {};
        const reasons = Array.isArray(attrs.__invalidReasons)
          ? (attrs.__invalidReasons as unknown[]).map((x) => String(x || "")).filter(Boolean)
          : [];
        return {
          cuid: row.cuid,
          country: row.country,
          provider: row.provider,
          name: row.name,
          phone: row.phone,
          email: row.email,
          reasons,
          quarantinedAt: String(attrs.__quarantineAt || row.updatedAt.toISOString()),
        };
      })
      .filter((x) => (reasonFilter ? x.reasons.includes(reasonFilter) : true));
    const total = await prisma.customer.count({ where: baseWhere });
    return res.json({ items, total, page, pageSize });
  });

  app.post("/api/customers/quarantine/release", async (req, res) => {
    const cuids = Array.isArray((req.body as any)?.cuids)
      ? ((req.body as any).cuids as unknown[]).map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    if (!cuids.length) return res.status(400).json({ error: "cuids_required" });
    const rows = await prisma.customer.findMany({
      where: { cuid: { in: cuids } },
      select: { cuid: true, attrs: true },
    });
    const promotedWritable = await loadPromotedWritableColumns(prisma);
    const fpBatch: Array<{ cuid: string; fpValues: Record<string, string> }> = [];
    let released = 0;
    for (const row of rows) {
      const attrs =
        row.attrs && typeof row.attrs === "object" && !Array.isArray(row.attrs)
          ? { ...(row.attrs as Record<string, unknown>) }
          : {};
      delete attrs.__invalidReasons;
      delete attrs.__quarantineAt;
      delete attrs.__quarantineSource;
      const { attrs: cleanAttrs, fpValues } = stripPromotedKeysToFpValues(attrs, promotedWritable);
      if (Object.keys(fpValues).length > 0) fpBatch.push({ cuid: row.cuid, fpValues });
      await prisma.customer.update({
        where: { cuid: row.cuid },
        data: {
          isError: false,
          attrs: cleanAttrs as Prisma.InputJsonValue,
        },
      });
      released += 1;
    }
    if (fpBatch.length) await applyPromotedFpValuesForCuids(prisma, fpBatch);
    await syncPromotedColumnsForCuids(
      prisma,
      rows.map((row) => String(row.cuid))
    );
    await writeAuditLog({
      action: "customer.quarantine.release",
      targetType: "customer",
      detail: { released, requested: cuids.length },
    });
    return res.json({ released });
  });

  app.post("/api/customers/quarantine/delete", async (req, res) => {
    const cuids = Array.isArray((req.body as any)?.cuids)
      ? ((req.body as any).cuids as unknown[]).map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    if (!cuids.length) return res.status(400).json({ error: "cuids_required" });
    let deleted = 0;
    for (const ids of chunkItems(cuids, 5000)) {
      const result = await prisma.customer.deleteMany({
        where: { cuid: { in: ids }, isError: true },
      });
      deleted += Number(result.count || 0);
    }
    await writeAuditLog({
      action: "customer.quarantine.delete",
      targetType: "customer",
      detail: { deleted, requested: cuids.length },
    });
    return res.json({ deleted });
  });

  app.post("/api/customers/quarantine/delete-by-filter", async (req, res) => {
    const reason = String((req.body as any)?.reason || "").trim();
    const includeLegacy = Boolean((req.body as any)?.includeLegacy);
    const baseWhere: Prisma.CustomerWhereInput = includeLegacy
      ? { isError: true }
      : {
          isError: true,
          attrs: {
            path: ["__quarantineSource"],
            equals: "clean-invalid",
          },
        };
    if (!reason) {
      const result = await prisma.customer.deleteMany({ where: baseWhere });
      await writeAuditLog({
        action: "customer.quarantine.delete-by-filter",
        targetType: "customer",
        detail: { deleted: Number(result.count || 0), reason: "all", includeLegacy },
      });
      return res.json({ deleted: Number(result.count || 0) });
    }
    const rows = await prisma.customer.findMany({
      where: baseWhere,
      select: { cuid: true, attrs: true },
      take: 200000,
    });
    const matchedCuids: string[] = [];
    for (const row of rows as any[]) {
      const attrs =
        row.attrs && typeof row.attrs === "object" && !Array.isArray(row.attrs)
          ? (row.attrs as Record<string, unknown>)
          : {};
      const reasons = Array.isArray(attrs.__invalidReasons)
        ? (attrs.__invalidReasons as unknown[]).map((x) => String(x || "")).filter(Boolean)
        : [];
      if (reasons.includes(reason)) matchedCuids.push(String(row.cuid));
    }
    let deleted = 0;
    for (const ids of chunkItems(matchedCuids, 5000)) {
      const result = await prisma.customer.deleteMany({
        where: { cuid: { in: ids }, isError: true },
      });
      deleted += Number(result.count || 0);
    }
    await writeAuditLog({
      action: "customer.quarantine.delete-by-filter",
      targetType: "customer",
      detail: { deleted, reason, includeLegacy },
    });
    return res.json({ deleted });
  });

  app.post("/api/customers/quarantine/release-by-filter", async (req, res) => {
    const reason = String((req.body as any)?.reason || "").trim();
    const includeLegacy = Boolean((req.body as any)?.includeLegacy);
    const baseWhere: Prisma.CustomerWhereInput = includeLegacy
      ? { isError: true }
      : {
          isError: true,
          attrs: {
            path: ["__quarantineSource"],
            equals: "clean-invalid",
          },
        };

    if (!reason) {
      const rows = await prisma.customer.findMany({
        where: baseWhere,
        select: { cuid: true, attrs: true },
        take: 200000,
      });
      const promotedWritable = await loadPromotedWritableColumns(prisma);
      const fpBatch: Array<{ cuid: string; fpValues: Record<string, string> }> = [];
      let released = 0;
      const releasedCuids: string[] = [];
      for (const row of rows as any[]) {
        const attrs =
          row.attrs && typeof row.attrs === "object" && !Array.isArray(row.attrs)
            ? { ...(row.attrs as Record<string, unknown>) }
            : {};
        delete attrs.__invalidReasons;
        delete attrs.__quarantineAt;
        delete attrs.__quarantineSource;
        const { attrs: cleanAttrs, fpValues } = stripPromotedKeysToFpValues(attrs, promotedWritable);
        if (Object.keys(fpValues).length > 0) fpBatch.push({ cuid: String(row.cuid), fpValues });
        await prisma.customer.update({
          where: { cuid: String(row.cuid) },
          data: { isError: false, attrs: cleanAttrs as Prisma.InputJsonValue },
        });
        releasedCuids.push(String(row.cuid));
        released += 1;
      }
      if (fpBatch.length) await applyPromotedFpValuesForCuids(prisma, fpBatch);
      await syncPromotedColumnsForCuids(prisma, releasedCuids);
      await writeAuditLog({
        action: "customer.quarantine.release-by-filter",
        targetType: "customer",
        detail: { released, reason: "all", includeLegacy },
      });
      return res.json({ released });
    }

    const rows = await prisma.customer.findMany({
      where: baseWhere,
      select: { cuid: true, attrs: true },
      take: 200000,
    });
    const promotedWritableFiltered = await loadPromotedWritableColumns(prisma);
    const fpBatchFiltered: Array<{ cuid: string; fpValues: Record<string, string> }> = [];
    let released = 0;
    const releasedCuids: string[] = [];
    for (const row of rows as any[]) {
      const attrs =
        row.attrs && typeof row.attrs === "object" && !Array.isArray(row.attrs)
          ? { ...(row.attrs as Record<string, unknown>) }
          : {};
      const reasons = Array.isArray(attrs.__invalidReasons)
        ? (attrs.__invalidReasons as unknown[]).map((x) => String(x || "")).filter(Boolean)
        : [];
      if (!reasons.includes(reason)) continue;
      delete attrs.__invalidReasons;
      delete attrs.__quarantineAt;
      delete attrs.__quarantineSource;
      const { attrs: cleanAttrs, fpValues } = stripPromotedKeysToFpValues(attrs, promotedWritableFiltered);
      if (Object.keys(fpValues).length > 0) fpBatchFiltered.push({ cuid: String(row.cuid), fpValues });
      await prisma.customer.update({
        where: { cuid: String(row.cuid) },
        data: { isError: false, attrs: cleanAttrs as Prisma.InputJsonValue },
      });
      releasedCuids.push(String(row.cuid));
      released += 1;
    }
    if (fpBatchFiltered.length) await applyPromotedFpValuesForCuids(prisma, fpBatchFiltered);
    await syncPromotedColumnsForCuids(prisma, releasedCuids);
    await writeAuditLog({
      action: "customer.quarantine.release-by-filter",
      targetType: "customer",
      detail: { released, reason, includeLegacy },
    });
    return res.json({ released });
  });
}
