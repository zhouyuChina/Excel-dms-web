import type { RecordData } from "@/data/mockData";

const API_BASE = "";
type ApiErrorPayload = { error?: string; message?: string; details?: Record<string, unknown> };

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return false;
  const res = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return false;
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
  };
  if (!data.access_token || !data.refresh_token) return false;
  localStorage.setItem("token", data.access_token);
  localStorage.setItem("refreshToken", data.refresh_token);
  return true;
}

async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  let res = await fetch(input, {
    ...init,
    headers: { ...(init?.headers || {}), ...authHeaders() },
  });
  if (res.status !== 401) return res;
  const refreshed = await refreshAccessToken();
  if (!refreshed) return res;
  res = await fetch(input, {
    ...init,
    headers: { ...(init?.headers || {}), ...authHeaders() },
  });
  return res;
}

async function parseApiError(res: Response, fallback: string): Promise<string> {
  const err = (await res.json().catch(() => ({}))) as ApiErrorPayload;
  if (err.message) return err.message;
  if (err.error) return err.error;
  return `${fallback} ${res.status}`;
}

/** 將 API／fetch 丟出的錯誤轉成可顯示字串（優先使用 Error.message）。 */
export function formatApiThrownError(e: unknown, fallback: string): string {
  if (e instanceof Error) {
    const m = e.message.trim();
    if (m) return m;
  }
  return fallback;
}

export type CustomersListResponse = {
  items: RecordData[];
  /** null：後端略過 COUNT（例如動態 attrs 篩選，避免雙重全表掃描） */
  total: number | null;
  /** 為 true 時 total 來自 PostgreSQL 統計近似值（無篩選時），非精確 COUNT(*) */
  totalApproximate?: boolean;
  /** 略過精確總筆數（僅依 hasMore / 本分頁筆數） */
  totalSkipped?: boolean;
  page: number;
  pageSize: number;
  mode?: "keyset" | "offset";
  cursor?: string | null;
  nextCursor?: string | null;
  hasMore?: boolean;
  queryMode?: "prisma-keyset" | "promoted-sql-keyset";
  queryElapsedMs?: number;
  cap?: number;
  sampleMode?: "sequential" | "random";
};

export type FieldDefinitionDTO = {
  id: string;
  key: string;
  name: string;
  uiColor: string;
  type: string;
  category: string;
  aliases: unknown;
  source: string;
  isRequired: boolean;
  isSystem: boolean;
  defaultVisible: boolean;
  isExportable: boolean;
  sortOrder: number;
  group: string;
  groupId: string | null;
  storageMode: string;
  promotionStatus: string;
  promotionJobId: string | null;
  promotionSourceHeader: string | null;
  promotionRules: unknown;
  promotionPlan: unknown;
  promotionUpdatedAt: string | null;
};

export type FieldGroupDTO = {
  id: string;
  name: string;
  color: string;
  isSystem: boolean;
  sortOrder: number;
};

export type CustomerFilterSnapshot = {
  q: string;
  exportStatus: string;
  filters: Array<{ field: string; operator: string; value: string }>;
  sortField: string;
  sortDir: string;
  visibleFieldKeys?: string[];
};

export async function fetchCustomersList(params: {
  pageSize: number;
  q: string;
  exportStatus: "all" | "exported" | "not-exported";
  sortField: string;
  sortDir: "asc" | "desc";
  filters: Array<{ id: string; field: string; operator: string; value: string }>;
  cursor?: string | null;
  visibleFieldKeys?: string[];
  /** 強制精確 COUNT(*)（可能極慢；匯出前可選） */
  exactTotal?: boolean;
  signal?: AbortSignal;
}): Promise<CustomersListResponse> {
  const sp = new URLSearchParams();
  sp.set("pageSize", String(params.pageSize));
  if (params.q) sp.set("q", params.q);
  if (params.exportStatus !== "all") sp.set("exportStatus", params.exportStatus);
  if (params.sortField) {
    sp.set("sortField", params.sortField);
    sp.set("sortDir", params.sortDir);
  }
  if (params.cursor) sp.set("cursor", params.cursor);
  if (params.exactTotal) sp.set("exactTotal", "1");
  if (params.visibleFieldKeys?.length) {
    sp.set("visibleFieldKeys", JSON.stringify(params.visibleFieldKeys));
  }
  const rules = params.filters.map(({ field, operator, value }) => ({ field, operator, value }));
  if (rules.length) sp.set("filters", JSON.stringify(rules));

  const res = await fetch(`${API_BASE}/api/customers?${sp.toString()}`, { signal: params.signal });
  if (!res.ok) throw new Error(`customers ${res.status}`);
  return res.json() as Promise<CustomersListResponse>;
}

export async function fetchCustomerQueryContract(): Promise<{
  pagination: { mode: string; defaultPageSize: number; maxPageSize: number };
  sorting: { defaultField: string; defaultDirection: "asc" | "desc"; allowedFields: string[] };
  filters: { allowedFields: string[]; operators: string[] };
}> {
  const res = await fetch(`${API_BASE}/api/customers/query-contract`);
  if (!res.ok) throw new Error(`query-contract ${res.status}`);
  return res.json() as Promise<{
    pagination: { mode: string; defaultPageSize: number; maxPageSize: number };
    sorting: { defaultField: string; defaultDirection: "asc" | "desc"; allowedFields: string[] };
    filters: { allowedFields: string[]; operators: string[] };
  }>;
}

export async function fetchCustomersMeta(): Promise<{ countries: string[]; providers: string[] }> {
  const res = await fetch(`${API_BASE}/api/customers/meta`);
  if (!res.ok) throw new Error(`meta ${res.status}`);
  return res.json() as Promise<{ countries: string[]; providers: string[] }>;
}

export async function fetchFieldDefinitions(): Promise<{ items: FieldDefinitionDTO[] }> {
  const res = await fetch(`${API_BASE}/api/field-definitions`);
  if (!res.ok) throw new Error(`field-definitions ${res.status}`);
  return res.json() as Promise<{ items: FieldDefinitionDTO[] }>;
}

export async function fetchFieldGroups(): Promise<{ items: FieldGroupDTO[] }> {
  const res = await fetch(`${API_BASE}/api/field-groups`);
  if (!res.ok) throw new Error(`field-groups ${res.status}`);
  return res.json() as Promise<{ items: FieldGroupDTO[] }>;
}

export async function createFieldGroup(data: {
  name: string;
  color?: string;
  sortOrder?: number;
}): Promise<{ item: FieldGroupDTO }> {
  const res = await fetch(`${API_BASE}/api/field-groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`create field-group ${res.status}`);
  return res.json() as Promise<{ item: FieldGroupDTO }>;
}

export async function patchFieldGroup(
  id: string,
  data: Partial<Pick<FieldGroupDTO, "name" | "color" | "sortOrder">>
): Promise<{ item: FieldGroupDTO }> {
  const res = await fetch(`${API_BASE}/api/field-groups/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`patch field-group ${res.status}`);
  return res.json() as Promise<{ item: FieldGroupDTO }>;
}

export async function deleteFieldGroup(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/field-groups/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) throw new Error(`delete field-group ${res.status}`);
}

export async function createFieldDefinition(data: {
  key?: string;
  name: string;
  uiColor?: string;
  type?: string;
  category?: string;
  aliases?: string[];
  isRequired?: boolean;
  defaultVisible?: boolean;
  isExportable?: boolean;
  sortOrder?: number;
  groupId?: string | null;
}): Promise<{ item: FieldDefinitionDTO }> {
  const res = await fetch(`${API_BASE}/api/field-definitions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`create field ${res.status}`);
  return res.json() as Promise<{ item: FieldDefinitionDTO }>;
}

export async function patchFieldDefinition(
  id: string,
  data: Partial<
    Pick<
      FieldDefinitionDTO,
      | "name"
      | "uiColor"
      | "type"
      | "category"
      | "aliases"
      | "source"
      | "isRequired"
      | "defaultVisible"
      | "isExportable"
      | "sortOrder"
      | "groupId"
    >
  >
): Promise<{ item: FieldDefinitionDTO }> {
  const res = await fetch(`${API_BASE}/api/field-definitions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`patch field ${res.status}`);
  return res.json() as Promise<{ item: FieldDefinitionDTO }>;
}

export async function deleteFieldDefinition(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/field-definitions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) throw new Error(`delete field ${res.status}`);
}

export async function patchCustomer(
  cuid: string,
  data: Partial<
    Pick<
      RecordData,
      | "name"
      | "englishName"
      | "age"
      | "birthDate"
      | "position"
      | "salary"
      | "email"
      | "phone"
      | "country"
      | "department"
      | "provider"
      | "recipient"
      | "isError"
      | "importRecord"
      | "exportRecord"
    >
  >
): Promise<RecordData> {
  const res = await fetch(`${API_BASE}/api/customers/${encodeURIComponent(cuid)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`patch ${res.status}`);
  return res.json() as Promise<RecordData>;
}

export async function deleteCustomer(cuid: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/customers/${encodeURIComponent(cuid)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) throw new Error(`delete ${res.status}`);
}

export async function bulkDeleteCustomers(cuids: string[]): Promise<{ deleted: number }> {
  const res = await fetch(`${API_BASE}/api/customers/bulk-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cuids }),
  });
  if (!res.ok) throw new Error(`bulk-delete ${res.status}`);
  return res.json() as Promise<{ deleted: number }>;
}

export async function bulkDeleteCustomersByFilter(filterSnapshot: CustomerFilterSnapshot): Promise<{ deleted: number }> {
  const res = await fetch(`${API_BASE}/api/customers/bulk-delete-by-filter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filterSnapshot }),
  });
  if (!res.ok) throw new Error(`bulk-delete-by-filter ${res.status}`);
  return res.json() as Promise<{ deleted: number }>;
}

export async function addRemarksJob(body: {
  target: "selected" | "filtered" | "all";
  cuids?: string[];
  filterSnapshot?: CustomerFilterSnapshot;
  fieldName: string;
  fieldKey?: string;
  remarkContent?: string;
}): Promise<{ updated: number; fieldKey: string; fieldName?: string }> {
  const res = await fetch(`${API_BASE}/api/customers/add-remarks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `add-remarks ${res.status}`);
  }
  return res.json() as Promise<{ updated: number; fieldKey: string; fieldName?: string }>;
}

export async function mergeDuplicatesJob(body: {
  keepStrategy: "keep-latest-updated" | "keep-oldest-created" | "keep-most-complete";
  fieldStrategy: "merge-fill-empty" | "merge-latest-wins";
}): Promise<{ mergedGroups: number; deletedRows: number; duplicateGroupsFound: number }> {
  const res = await fetch(`${API_BASE}/api/jobs/merge-duplicates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "merge-duplicates"));
  }
  return res.json() as Promise<{ mergedGroups: number; deletedRows: number; duplicateGroupsFound: number }>;
}

export async function mergeFieldsJob(body: {
  sourceKeys: string[];
  targetName: string;
  mergeStrategy: "prioritize_non_empty" | "keep_first" | "keep_last" | "concatenate";
  sourceFieldHandling: "hide_field" | "keep_field" | "delete_field";
}): Promise<{
  jobId: string;
  status: "queued";
  targetName: string;
  mergedSourceCount: number;
  sourceFieldHandling: string;
  deduped?: boolean;
  queuePosition?: number;
  estimatedWaitSec?: number;
  taskSummary?: string;
}> {
  const res = await fetch(`${API_BASE}/api/jobs/merge-fields`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "merge-fields"));
  }
  return res.json() as Promise<{
    jobId: string;
    status: "queued";
    targetName: string;
    mergedSourceCount: number;
    sourceFieldHandling: string;
    deduped?: boolean;
    queuePosition?: number;
    estimatedWaitSec?: number;
    taskSummary?: string;
  }>;
}

export type MergeFieldsJobStatus = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  totalRows: number;
  processedRows: number;
  changedRows: number;
  targetKey?: string;
  targetName?: string;
  sourceFieldHandling?: "hide_field" | "keep_field" | "delete_field";
  message?: string;
  error?: string;
  queuePosition?: number;
  estimatedWaitSec?: number;
};

export async function fetchMergeFieldsJob(jobId: string): Promise<MergeFieldsJobStatus> {
  const res = await fetch(`${API_BASE}/api/jobs/merge-fields/${encodeURIComponent(jobId)}`);
  if (!res.ok) throw new Error(await parseApiError(res, "merge-fields-job"));
  return res.json() as Promise<MergeFieldsJobStatus>;
}

export async function previewMergeFieldsJob(body: {
  sourceKeys: string[];
  targetName: string;
  mergeStrategy: "prioritize_non_empty" | "keep_first" | "keep_last" | "concatenate";
  sourceFieldHandling?: "hide_field" | "keep_field" | "delete_field";
}): Promise<{
  totalRows: number;
  rowsWithAnySourceValue: number;
  rowsWillWriteTarget: number;
  rowsTargetChanged: number;
  targetKey: string;
  targetExists: boolean;
  riskLevel: "low" | "medium" | "high";
  warnings: string[];
  riskThresholds?: { medium: number; high: number };
}> {
  const res = await fetch(`${API_BASE}/api/jobs/merge-fields/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "merge-fields-preview"));
  }
  return res.json() as Promise<{
    totalRows: number;
    rowsWithAnySourceValue: number;
    rowsWillWriteTarget: number;
    rowsTargetChanged: number;
    targetKey: string;
    targetExists: boolean;
    riskLevel: "low" | "medium" | "high";
    warnings: string[];
    riskThresholds?: { medium: number; high: number };
  }>;
}

export async function previewCleanInvalidJob(body: {
  target: "selected" | "filtered" | "all";
  cuids?: string[];
  filterSnapshot?: CustomerFilterSnapshot;
  rules?: Array<"phone_empty" | "email_invalid" | "phone_country_invalid">;
}): Promise<{
  targetRows: number;
  invalidRows: number;
  rules: string[];
  byRule: Record<string, number>;
}> {
  const res = await fetch(`${API_BASE}/api/jobs/clean-invalid/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "clean-invalid-preview"));
  }
  return res.json() as Promise<{
    targetRows: number;
    invalidRows: number;
    rules: string[];
    byRule: Record<string, number>;
  }>;
}

export async function cleanInvalidJob(body: {
  target: "selected" | "filtered" | "all";
  cuids?: string[];
  filterSnapshot?: CustomerFilterSnapshot;
  rules?: Array<"phone_empty" | "email_invalid" | "phone_country_invalid">;
  mode?: "quarantine" | "delete";
}): Promise<{
  status: "queued";
  jobId: string;
  queuePosition?: number;
  estimatedWaitSec?: number;
  mode?: "quarantine" | "delete";
  rules: string[];
}> {
  const res = await fetch(`${API_BASE}/api/jobs/clean-invalid`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "clean-invalid"));
  }
  return res.json() as Promise<{
    status: "queued";
    jobId: string;
    queuePosition?: number;
    estimatedWaitSec?: number;
    mode?: "quarantine" | "delete";
    rules: string[];
  }>;
}

export async function fetchQuarantineList(params?: {
  page?: number;
  pageSize?: number;
  reason?: string;
}): Promise<{
  total: number;
  page: number;
  pageSize: number;
  items: Array<{
    cuid: string;
    country: string;
    provider: string;
    name: string;
    phone: string;
    email: string;
    reasons: string[];
    quarantinedAt: string;
  }>;
}> {
  const sp = new URLSearchParams();
  sp.set("page", String(params?.page ?? 1));
  sp.set("pageSize", String(params?.pageSize ?? 50));
  if (params?.reason) sp.set("reason", params.reason);
  const res = await fetch(`${API_BASE}/api/customers/quarantine?${sp.toString()}`);
  if (!res.ok) throw new Error(await parseApiError(res, "quarantine-list"));
  return res.json() as Promise<{
    total: number;
    page: number;
    pageSize: number;
    items: Array<{
      cuid: string;
      country: string;
      provider: string;
      name: string;
      phone: string;
      email: string;
      reasons: string[];
      quarantinedAt: string;
    }>;
  }>;
}

export async function releaseQuarantine(cuids: string[]): Promise<{ released: number }> {
  const res = await fetch(`${API_BASE}/api/customers/quarantine/release`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cuids }),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "quarantine-release"));
  return res.json() as Promise<{ released: number }>;
}

export async function releaseQuarantineByFilter(params: {
  reason?: string;
  includeLegacy?: boolean;
}): Promise<{ released: number }> {
  const res = await fetch(`${API_BASE}/api/customers/quarantine/release-by-filter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reason: params.reason || "",
      includeLegacy: Boolean(params.includeLegacy),
    }),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "quarantine-release-by-filter"));
  return res.json() as Promise<{ released: number }>;
}

export async function deleteQuarantine(cuids: string[]): Promise<{ deleted: number }> {
  const res = await fetch(`${API_BASE}/api/customers/quarantine/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cuids }),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "quarantine-delete"));
  return res.json() as Promise<{ deleted: number }>;
}

export async function deleteQuarantineByFilter(params: {
  reason?: string;
  includeLegacy?: boolean;
}): Promise<{ deleted: number }> {
  const res = await fetch(`${API_BASE}/api/customers/quarantine/delete-by-filter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reason: params.reason || "",
      includeLegacy: Boolean(params.includeLegacy),
    }),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "quarantine-delete-by-filter"));
  return res.json() as Promise<{ deleted: number }>;
}

export type ImportColumnMappingEntry =
  | { mode: "skip" }
  | { mode: "merge"; targetKey: string }
  | { mode: "new" };

export type AnalyzeImportResponse = {
  fileName: string;
  headers: string[];
  columns: Array<{
    header: string;
    normalized: string;
    kind: "core" | "existing" | "new";
    suggestedKey: string;
  }>;
  samples: Record<string, string>[];
  mergeTargets: Array<{ key: string; name: string }>;
};

export async function analyzeImportFile(file: File): Promise<AnalyzeImportResponse> {
  const fd = new FormData();
  fd.append("file", file);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/imports/analyze`, {
      method: "POST",
      body: fd,
    });
  } catch {
    throw new Error("後端連線失敗（請確認 API 服務已啟動）");
  }
  const json = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  if (!res.ok) {
    throw new Error(json.message || json.error || `解析失敗 ${res.status}`);
  }
  return json as AnalyzeImportResponse;
}

export async function createImportJob(
  file: File,
  country: string,
  provider: string,
  columnMapping?: Record<string, ImportColumnMappingEntry> | null
): Promise<
  | { status: "queued"; jobId: string; deduped?: boolean; queuePosition?: number; estimatedWaitSec?: number }
  | { status: "completed"; jobId: string; insertedCount: number }
  | {
      status: "failed";
      jobId?: string;
      primaryReason: string;
      errorRowNumbers: number[];
      errorCount: number;
    }
> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("country", country);
  fd.append("provider", provider);
  if (columnMapping && Object.keys(columnMapping).length > 0) {
    fd.append("columnMapping", JSON.stringify(columnMapping));
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/imports`, {
      method: "POST",
      body: fd,
    });
  } catch {
    throw new Error("後端連線失敗（請確認 API 服務已啟動，預設為 127.0.0.1:8080）");
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 400) {
    throw new Error(String(json.message || json.error || "匯入請求無效"));
  }
  if (res.status === 202) {
    return {
      status: "queued",
      jobId: String(json.jobId || ""),
      deduped: Boolean(json.deduped),
      queuePosition: Number(json.queuePosition ?? 0),
      estimatedWaitSec: Number(json.estimatedWaitSec ?? 0),
    };
  }
  if (res.ok) {
    return {
      status: "completed",
      jobId: String(json.jobId || ""),
      insertedCount: Number(json.insertedCount ?? 0),
    };
  }
  return {
    status: "failed",
    jobId: json.jobId != null ? String(json.jobId) : undefined,
    primaryReason: String(json.primaryReason || json.error || "匯入失敗"),
    errorRowNumbers: Array.isArray(json.errorRowNumbers)
      ? (json.errorRowNumbers as number[])
      : [],
    errorCount: Number(json.errorCount ?? 0),
  };
}

export type ImportJobItem = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  fileName: string;
  country: string;
  provider: string;
  totalRows: number;
  processedRows: number;
  successRows: number;
  failedRows: number;
  checkpointChunk: number;
  chunkSize: number;
  canRetry: boolean;
  errorPrimary?: string;
  errorCount: number;
  errorRowNumbers?: unknown;
  errorReportPath?: string;
  createdAt: string;
  finishedAt?: string;
};

export const OPEN_MODULE_EVENT = "APP_OPEN_MODULE";
export const IMPORT_QUICK_FILTER_KEY = "importRecords.quickFilter.v1";

export async function fetchImportJobs(): Promise<{ items: ImportJobItem[] }> {
  const res = await fetch(`${API_BASE}/api/imports`);
  if (!res.ok) throw new Error(`imports ${res.status}`);
  return res.json() as Promise<{ items: ImportJobItem[] }>;
}

export type UnifiedJobItem = {
  id: string;
  source: "import" | "merge-fields" | "export" | "clean-invalid" | "field-promotion";
  status: "queued" | "processing" | "completed" | "failed";
  state?:
    | "queued"
    | "rules-confirmed"
    | "pending-maintenance"
    | "scheduled-on-restart"
    | "applying"
    | "applied"
    | "failed";
  title: string;
  subtitle: string;
  cleanupDone?: boolean;
  createdAt: string;
  processedRows: number;
  totalRows: number;
  canRetry?: boolean;
  queuePosition?: number;
  estimatedWaitSec?: number;
};

export async function fetchUnifiedJobs(params?: {
  limit?: number;
  source?: "all" | "import" | "merge-fields" | "export" | "clean-invalid" | "field-promotion";
  status?: "all" | "queued" | "processing" | "completed" | "failed";
}): Promise<{ items: UnifiedJobItem[] }> {
  const sp = new URLSearchParams();
  sp.set("limit", String(params?.limit ?? 100));
  if (params?.source) sp.set("source", params.source);
  if (params?.status) sp.set("status", params.status);
  const res = await fetch(`${API_BASE}/api/jobs?${sp.toString()}`);
  if (!res.ok) throw new Error(`jobs ${res.status}`);
  return res.json() as Promise<{ items: UnifiedJobItem[] }>;
}

export type FieldPromotionRuleField = {
  key: string;
  name: string;
  sourceHeader: string;
  sampleValues: string[];
};

export type FieldPromotionJobDetail = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  state:
    | "queued"
    | "rules-confirmed"
    | "pending-maintenance"
    | "scheduled-on-restart"
    | "applying"
    | "applied"
    | "failed";
  title: string;
  subtitle: string;
  createdAt: string;
  finishedAt?: string | null;
  importJobId?: string;
  fields: FieldPromotionRuleField[];
  rules?: {
    type?: "文字" | "數字" | "日期" | "電子郵件" | "電話";
    allowNull?: boolean;
    enableFilter?: boolean;
    enableSort?: boolean;
    writeAliases?: boolean;
    purgeAttrsAfterPromotion?: boolean;
    note?: string;
  };
  plan?: {
    version: number;
    generatedAt: string;
    mode: "metadata-only" | "schema-and-backfill";
    fields: Array<{
      key: string;
      name: string;
      currentStorageMode: "dynamic" | "promoted";
      targetFixedColumnKey: string;
      targetFixedColumnName?: string;
      rules: NonNullable<FieldPromotionJobDetail["rules"]>;
    }>;
    steps: string[];
    blockers: string[];
    notes: string[];
  } | null;
  scheduledForRestartAt?: string | null;
  lastError?: {
    summary: string;
    technicalDetail?: string;
    failedAt?: string;
  } | null;
  technicalError?: string;
  cleanup?: {
    lastPreview?: {
      generatedAt: string;
      fields: Array<{
        key: string;
        column: string;
        totalWithAttr: number;
        matchedPromoted: number;
        mismatch: number;
        missingPromoted: number;
      }>;
      totals: {
        totalWithAttr: number;
        matchedPromoted: number;
        mismatch: number;
        missingPromoted: number;
      };
    };
    lastApplied?: {
      jobId: string;
      appliedAt: string;
      removed: Array<{ key: string; column: string; removedRows: number }>;
      totalRemovedRows: number;
      note: string;
      idempotencyKey: string;
    };
  } | null;
  result?: {
    state?: string;
    appliedColumns?: string[];
    totalBackfilledRows?: number;
    applyReport?: Array<{
      key: string;
      column: string;
      backfilledRows: number;
      status: "applied";
    }>;
    summary?: string;
    technicalDetail?: string;
  } | null;
};

export async function fetchFieldPromotionJob(jobId: string): Promise<FieldPromotionJobDetail> {
  const res = await fetch(`${API_BASE}/api/jobs/field-promotion/${encodeURIComponent(jobId)}`);
  if (!res.ok) throw new Error(await parseApiError(res, "field-promotion-detail"));
  return res.json() as Promise<FieldPromotionJobDetail>;
}

export async function submitFieldPromotionRules(
  jobId: string,
  body: NonNullable<FieldPromotionJobDetail["rules"]>
): Promise<{ saved: boolean; jobId: string }> {
  const res = await fetch(`${API_BASE}/api/jobs/field-promotion/${encodeURIComponent(jobId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "field-promotion-save"));
  return res.json() as Promise<{ saved: boolean; jobId: string }>;
}

export async function scheduleFieldPromotionOnRestart(
  jobId: string
): Promise<{ scheduled: boolean; jobId: string; state: string }> {
  const res = await fetch(
    `${API_BASE}/api/jobs/field-promotion/${encodeURIComponent(jobId)}/schedule-restart`,
    {
      method: "POST",
    }
  );
  if (!res.ok) throw new Error(await parseApiError(res, "field-promotion-schedule"));
  return res.json() as Promise<{ scheduled: boolean; jobId: string; state: string }>;
}

export async function previewFieldPromotionCleanup(jobId: string): Promise<{
  preview: NonNullable<NonNullable<FieldPromotionJobDetail["cleanup"]>["lastPreview"]>;
}> {
  const res = await fetch(
    `${API_BASE}/api/jobs/field-promotion/${encodeURIComponent(jobId)}/cleanup-preview`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error(await parseApiError(res, "field-promotion-cleanup-preview"));
  return res.json() as Promise<{
    preview: NonNullable<NonNullable<FieldPromotionJobDetail["cleanup"]>["lastPreview"]>;
  }>;
}

export async function applyFieldPromotionCleanup(jobId: string): Promise<{
  applied: NonNullable<NonNullable<FieldPromotionJobDetail["cleanup"]>["lastApplied"]>;
}> {
  const res = await fetch(
    `${API_BASE}/api/jobs/field-promotion/${encodeURIComponent(jobId)}/cleanup-apply`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: true }),
    }
  );
  if (!res.ok) throw new Error(await parseApiError(res, "field-promotion-cleanup-apply"));
  return res.json() as Promise<{
    applied: NonNullable<NonNullable<FieldPromotionJobDetail["cleanup"]>["lastApplied"]>;
  }>;
}

export function fieldPromotionCleanupMismatchReportUrl(jobId: string): string {
  return `${API_BASE}/api/jobs/field-promotion/${encodeURIComponent(jobId)}/cleanup-mismatch-report`;
}

export async function retryImportJob(jobId: string): Promise<{ retried: boolean; jobId: string }> {
  const res = await fetch(`${API_BASE}/api/imports/${encodeURIComponent(jobId)}/retry`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`retry-import ${res.status}`);
  return res.json() as Promise<{ retried: boolean; jobId: string }>;
}

export async function retryExportQueueJob(jobId: string): Promise<{
  retried: boolean;
  jobId: string;
  queuePosition?: number;
  estimatedWaitSec?: number;
}> {
  const res = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/retry`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await parseApiError(res, "retry-export"));
  return res.json() as Promise<{
    retried: boolean;
    jobId: string;
    queuePosition?: number;
    estimatedWaitSec?: number;
  }>;
}

export async function deleteImportJob(jobId: string): Promise<{
  deleted: boolean;
  deletedRows: number;
  skippedEditedRows: number;
}> {
  const res = await fetch(`${API_BASE}/api/imports/${encodeURIComponent(jobId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`delete-import ${res.status}`);
  return res.json() as Promise<{
    deleted: boolean;
    deletedRows: number;
    skippedEditedRows: number;
  }>;
}

export async function updateByFileJob(
  file: File
): Promise<
  | { status: "completed"; updatedCount: number }
  | {
      status: "failed";
      primaryReason: string;
      errorRowNumbers: number[];
      errorCount: number;
    }
> {
  const fd = new FormData();
  fd.append("file", file);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/jobs/update-by-file`, {
      method: "POST",
      body: fd,
    });
  } catch {
    throw new Error("後端連線失敗（請確認 API 服務已啟動，預設為 127.0.0.1:8080）");
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok) {
    return {
      status: "completed",
      updatedCount: Number(json.updatedCount ?? 0),
    };
  }
  if (json.error === "phone_country_update_not_allowed" || json.message) {
    return {
      status: "failed",
      primaryReason: String(json.message || json.error || "更新檔案不可修改 phone/country"),
      errorRowNumbers: [],
      errorCount: 1,
    };
  }
  return {
    status: "failed",
    primaryReason: String(json.primaryReason || json.error || "更新失敗"),
    errorRowNumbers: Array.isArray(json.errorRowNumbers)
      ? (json.errorRowNumbers as number[])
      : [],
    errorCount: Number(json.errorCount ?? 0),
  };
}

export async function createExportJob(body: {
  filterSnapshot: CustomerFilterSnapshot;
  recipient: string;
  remarks: string;
}): Promise<{
  status: "queued" | "processing" | "completed";
  jobId: string;
  deduped?: boolean;
  queuePosition?: number;
  estimatedWaitSec?: number;
}> {
  const res = await fetch(`${API_BASE}/api/exports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "export"));
  }
  return res.json() as Promise<{
    status: "queued" | "processing" | "completed";
    jobId: string;
    deduped?: boolean;
    queuePosition?: number;
    estimatedWaitSec?: number;
  }>;
}

export async function fetchJobResult(jobId: string): Promise<{
  id: string;
  source: string;
  status: string;
  result:
    | {
        exportId?: string;
        fileName?: string;
        files?: Array<{ fileName: string; rowCount?: number; part?: number }>;
      }
    | null;
  finishedAt: string | null;
}> {
  const res = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/result`);
  if (!res.ok) throw new Error(await parseApiError(res, "job-result"));
  return res.json() as Promise<{
    id: string;
    source: string;
    status: string;
    result:
      | {
          exportId?: string;
          fileName?: string;
          files?: Array<{ fileName: string; rowCount?: number; part?: number }>;
        }
      | null;
    finishedAt: string | null;
  }>;
}

export function jobResultFileDownloadUrl(jobId: string, fileName: string): string {
  return `${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/files/${encodeURIComponent(fileName)}/download`;
}

export type ExportListItem = {
  id: string;
  fileName: string;
  rowCount: number;
  recipient: string;
  remarks: string;
  createdAt: string;
};

export type AuditLogItem = {
  at: string;
  action: string;
  actor: string;
  targetType: string;
  targetId: string;
  detail: Record<string, unknown>;
};

export async function fetchExportList(): Promise<{ items: ExportListItem[] }> {
  const res = await fetch(`${API_BASE}/api/exports`);
  if (!res.ok) throw new Error(`exports ${res.status}`);
  return res.json() as Promise<{ items: ExportListItem[] }>;
}

export async function deleteExportJob(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/exports/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) throw new Error(`delete export ${res.status}`);
}

export function exportDownloadUrl(id: string): string {
  return `${API_BASE}/api/exports/${encodeURIComponent(id)}/download`;
}

export async function fetchAuditLogs(params?: {
  limit?: number;
  action?: string;
}): Promise<{ items: AuditLogItem[]; total: number }> {
  const sp = new URLSearchParams();
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.action) sp.set("action", params.action);
  const q = sp.toString();
  const res = await authFetch(`${API_BASE}/api/audit-logs${q ? `?${q}` : ""}`);
  if (!res.ok) throw new Error(`audit-logs ${res.status}`);
  return res.json() as Promise<{ items: AuditLogItem[]; total: number }>;
}

export async function authLogin(username: string, password: string): Promise<{
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: { id: string; username: string; role: "admin" | "editor" | "viewer" };
}> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "login_failed");
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    user: { id: string; username: string; role: "admin" | "editor" | "viewer" };
  }>;
}

export async function authMe(): Promise<{
  user: { sub: string; username: string; role: "admin" | "editor" | "viewer" };
}> {
  const res = await authFetch(`${API_BASE}/api/auth/me`);
  if (!res.ok) throw new Error("unauthorized");
  return res.json() as Promise<{
    user: { sub: string; username: string; role: "admin" | "editor" | "viewer" };
  }>;
}

export type RecoverySnapshotItem = {
  id: string;
  label: string;
  createdAt: string;
  createdBy: string;
  rowCount: number;
  restoredAt?: string;
};

export async function fetchRecoverySnapshots(): Promise<{ items: RecoverySnapshotItem[] }> {
  const res = await authFetch(`${API_BASE}/api/recovery/snapshots`);
  if (!res.ok) throw new Error(`recovery-snapshots ${res.status}`);
  return res.json() as Promise<{ items: RecoverySnapshotItem[] }>;
}

export function recoveryDownloadUrl(id: string): string {
  return `${API_BASE}/api/recovery/snapshots/${encodeURIComponent(id)}/download`;
}

export async function deleteRecoverySnapshot(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/api/recovery/snapshots/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 204) throw new Error(`delete-recovery ${res.status}`);
}

export async function uploadRecoverySnapshot(file: File, label?: string): Promise<{ id: string; rowCount: number }> {
  const fd = new FormData();
  fd.append("file", file);
  if (label) fd.append("label", label);
  const res = await authFetch(`${API_BASE}/api/recovery/snapshots/upload`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(`upload-recovery ${res.status}`);
  return res.json() as Promise<{ id: string; rowCount: number }>;
}

export async function createRecoverySnapshot(label: string): Promise<{ id: string; rowCount: number }> {
  const res = await authFetch(`${API_BASE}/api/recovery/snapshots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  if (!res.ok) throw new Error(`create-recovery ${res.status}`);
  return res.json() as Promise<{ id: string; rowCount: number }>;
}

export async function restoreRecoverySnapshot(
  id: string,
  mode: "full" | "selected" = "full",
  cuids?: string[]
): Promise<{ restored: boolean; rowCount: number }> {
  const res = await authFetch(`${API_BASE}/api/recovery/snapshots/${encodeURIComponent(id)}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, cuids }),
  });
  if (!res.ok) throw new Error(`restore-recovery ${res.status}`);
  return res.json() as Promise<{ restored: boolean; rowCount: number }>;
}

export async function previewRestoreRecoverySnapshot(
  id: string,
  mode: "full" | "selected",
  cuids?: string[]
): Promise<{ mode: "full" | "selected"; affectedRows: number; snapshotRows: number; selectedCount: number }> {
  const res = await authFetch(`${API_BASE}/api/recovery/snapshots/${encodeURIComponent(id)}/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, cuids }),
  });
  if (!res.ok) throw new Error(`preview-recovery ${res.status}`);
  return res.json() as Promise<{
    mode: "full" | "selected";
    affectedRows: number;
    snapshotRows: number;
    selectedCount: number;
  }>;
}

export async function authLogout(): Promise<void> {
  const refreshToken = localStorage.getItem("refreshToken");
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken || "" }),
  }).catch(() => undefined);
}
