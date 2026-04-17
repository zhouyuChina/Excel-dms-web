import type { Prisma } from "@prisma/client";

const KEY_TO_FIELD: Record<string, keyof Prisma.CustomerWhereInput> = {
  cuid: "cuid",
  country: "country",
  provider: "provider",
  phone: "phone",
  name: "name",
  englishName: "englishName",
  age: "age",
  birthDate: "birthDate",
  position: "position",
  salary: "salary",
  email: "email",
  department: "department",
  importRecord: "importRecord",
  exportRecord: "exportRecord",
  recipient: "recipient",
  isError: "isError",
};

const NUMERIC_KEYS = new Set(["age", "salary"]);

/** 是否為核心欄位（非動態 attrs） */
function isCoreFilterField(fieldKey: string): boolean {
  return Boolean(KEY_TO_FIELD[fieldKey]);
}
export const FILTERABLE_FIELD_KEYS = Object.keys(KEY_TO_FIELD);

function normalizeDigits(input: string): string {
  return String(input || "").replace(/\D+/g, "");
}

export function buildFilterAnd(
  conditions: Array<{ field: string; operator: string; value: string }>
): Prisma.CustomerWhereInput[] {
  const and: Prisma.CustomerWhereInput[] = [];
  for (const c of conditions) {
    const fieldKey = String(c.field || "").trim();
    if (!fieldKey || c.value === "") continue;

    const fixedKey = KEY_TO_FIELD[fieldKey];
    if (fixedKey) {
      const field = fixedKey as string;

      if (NUMERIC_KEYS.has(fieldKey)) {
        const n = Number(c.value);
        if (Number.isNaN(n)) continue;
        if (c.operator === "等於") and.push({ [field]: n });
        else if (c.operator === "不等於") and.push({ NOT: { [field]: n } });
        else if (c.operator === "大於") and.push({ [field]: { gt: n } });
        else if (c.operator === "小於") and.push({ [field]: { lt: n } });
        continue;
      }

      if (c.operator === "等於") {
        and.push({ [field]: { equals: c.value, mode: "insensitive" } });
      } else if (c.operator === "不等於") {
        and.push({ NOT: { [field]: { equals: c.value, mode: "insensitive" } } });
      } else if (c.operator === "包含") {
        and.push({ [field]: { contains: c.value, mode: "insensitive" } });
      } else if (c.operator === "不包含") {
        and.push({ NOT: { [field]: { contains: c.value, mode: "insensitive" } } });
      } else if (c.operator === "大於") {
        and.push({ [field]: { gt: c.value } });
      } else if (c.operator === "小於") {
        and.push({ [field]: { lt: c.value } });
      }
      continue;
    }

    // dynamic attrs 欄位：以字串比對（匯入時已存為 string）
    const path = [fieldKey];
    if (c.operator === "等於") {
      and.push({ attrs: { path, equals: c.value } });
    } else if (c.operator === "不等於") {
      and.push({ NOT: { attrs: { path, equals: c.value } } });
    } else if (c.operator === "包含") {
      and.push({ attrs: { path, string_contains: c.value } });
    } else if (c.operator === "不包含") {
      and.push({ NOT: { attrs: { path, string_contains: c.value } } });
    } else {
      // 動態欄位暫不支援數字比較
    }
  }
  return and;
}

export type ListQueryInput = {
  exportStatus: string;
  q: string;
  providerExact?: string;
  countryExact?: string;
  filterRules: Array<{ field: string; operator: string; value: string }>;
};

/**
 * 進階篩選含「動態欄位」（寫入 attrs JSON）時，COUNT(*) 與列表查詢同樣可能全表掃描；
 * 列表 API 可略過精確總筆數，只回傳本分頁與 hasMore，避免使用者多等一次與列表等長的計數。
 */
export function hasActiveDynamicAttrsFilter(
  filterRules: ListQueryInput["filterRules"]
): boolean {
  for (const r of filterRules) {
    if (!String(r.value || "").trim()) continue;
    const fieldKey = String(r.field || "").trim();
    if (fieldKey && !isCoreFilterField(fieldKey)) return true;
  }
  return false;
}

/** 列表為「全表、無關鍵字／精確國別／人事／進階篩選」時，可用 pg 統計近似筆數，避免 COUNT(*) 掃全表。 */
export function allowsApproximateListTotal(input: ListQueryInput): boolean {
  if (input.exportStatus !== "all") return false;
  if (String(input.q || "").trim()) return false;
  if (String(input.providerExact || "").trim()) return false;
  if (String(input.countryExact || "").trim()) return false;
  for (const r of input.filterRules) {
    if (String(r.value || "").trim()) return false;
  }
  return true;
}

export function shouldSkipExpensiveListCount(input: ListQueryInput): boolean {
  if (hasActiveDynamicAttrsFilter(input.filterRules)) return true;
  if (String(input.q || "").trim()) return true;
  return false;
}

export function buildCustomerWhere(input: ListQueryInput): Prisma.CustomerWhereInput {
  const clauses: Prisma.CustomerWhereInput[] = [];

  if (input.providerExact) {
    clauses.push({ provider: input.providerExact });
  }
  if (input.countryExact) {
    clauses.push({ country: input.countryExact });
  }

  if (input.exportStatus === "exported") {
    clauses.push({
      OR: [{ exportRecord: { not: "" } }, { exportMarks: { some: {} } }],
    });
  } else if (input.exportStatus === "not-exported") {
    clauses.push({
      AND: [{ exportRecord: "" }, { exportMarks: { none: {} } }],
    });
  }

  clauses.push(...buildFilterAnd(input.filterRules));

  if (input.q) {
    const qDigits = normalizeDigits(input.q);
    const qLower = input.q.toLowerCase();
    const qLooksLikeEmail = qLower.includes("@");
    clauses.push({
      OR: [
        { cuid: { startsWith: input.q, mode: "insensitive" } },
        ...(qDigits
          ? [
              { phoneNormalized: { startsWith: qDigits } },
              { phone: { startsWith: input.q, mode: "insensitive" as const } },
            ]
          : []),
        { name: { startsWith: input.q, mode: "insensitive" } },
        { englishName: { startsWith: input.q, mode: "insensitive" } },
        ...(qLooksLikeEmail
          ? [{ email: { startsWith: input.q, mode: "insensitive" as const } }]
          : []),
        { country: { startsWith: input.q, mode: "insensitive" } },
        { provider: { startsWith: input.q, mode: "insensitive" } },
        { department: { startsWith: input.q, mode: "insensitive" } },
      ],
    });
  }

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0]!;
  return { AND: clauses };
}

export const CUSTOMER_SORTABLE: Record<
  string,
  keyof Prisma.CustomerOrderByWithRelationInput
> = {
  cuid: "cuid",
  country: "country",
  provider: "provider",
  phone: "phone",
  name: "name",
  englishName: "englishName",
  age: "age",
  birthDate: "birthDate",
  position: "position",
  salary: "salary",
  email: "email",
  department: "department",
  importRecord: "importRecord",
  exportRecord: "exportRecord",
  recipient: "recipient",
  updatedAt: "updatedAt",
};
export const QUERY_SORT_WHITELIST = Object.keys(CUSTOMER_SORTABLE);

export function isFilterFieldAllowed(fieldKey: string): boolean {
  return Boolean(KEY_TO_FIELD[fieldKey]) || /^[a-z0-9_]+$/i.test(fieldKey);
}

export function buildCustomerOrderBy(
  sortField: string,
  sortDir: "asc" | "desc"
): Prisma.CustomerOrderByWithRelationInput[] {
  const orderBy: Prisma.CustomerOrderByWithRelationInput[] = [];
  const col = sortField && CUSTOMER_SORTABLE[sortField];
  if (col) orderBy.push({ [col]: sortDir });
  orderBy.push({ cuid: "asc" });
  return orderBy;
}
