import {
  fetchUnifiedJobs,
  retryExportQueueJob,
  retryImportJob,
  type UnifiedJobItem,
} from "@/lib/dmsApi";

const MERGE_FIELDS_JOB_IDS_KEY = "dms:recent-merge-fields-job-ids";
const MAX_RECENT_MERGE_JOB_IDS = 20;
export const JOB_EVENT_CREATED = "dms:job-created";
export const JOB_EVENT_STATUS_CHANGED = "dms:job-status-changed";

export type UnifiedTaskStatus = "queued" | "processing" | "completed" | "failed";
export type UnifiedTaskItem = {
  id: string;
  source: "import" | "merge-fields" | "export" | "clean-invalid" | "field-promotion";
  status: UnifiedTaskStatus;
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

function readJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => String(x || "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function getRecentMergeFieldJobIds(): string[] {
  if (typeof window === "undefined") return [];
  return readJsonArray(window.localStorage.getItem(MERGE_FIELDS_JOB_IDS_KEY));
}

export function addRecentMergeFieldJobId(jobId: string): void {
  if (typeof window === "undefined") return;
  const id = String(jobId || "").trim();
  if (!id) return;
  const current = getRecentMergeFieldJobIds();
  const merged = [id, ...current.filter((x) => x !== id)].slice(0, MAX_RECENT_MERGE_JOB_IDS);
  window.localStorage.setItem(MERGE_FIELDS_JOB_IDS_KEY, JSON.stringify(merged));
}

export function mapUnifiedTask(x: UnifiedJobItem): UnifiedTaskItem {
  return {
    id: x.id,
    source: x.source,
    status: x.status,
    state: x.state,
    title:
      x.title ||
      `${x.source === "import" ? "匯入任務" : x.source === "merge-fields" ? "合併欄位" : x.source === "clean-invalid" ? "清理無效" : x.source === "field-promotion" ? "欄位升級" : "匯出任務"} ${x.id.slice(0, 8)}`,
    subtitle:
      x.subtitle ||
      (x.source === "import"
        ? "匯入任務"
        : x.source === "merge-fields"
          ? "欄位合併任務"
          : x.source === "clean-invalid"
            ? "清理無效資料"
            : x.source === "field-promotion"
              ? "欄位升級任務"
              : "匯出任務"),
    cleanupDone: Boolean(x.cleanupDone),
    createdAt: x.createdAt,
    processedRows: Number(x.processedRows ?? 0),
    totalRows: Number(x.totalRows ?? 0),
    canRetry: Boolean(x.canRetry),
    queuePosition: Number(x.queuePosition ?? 0),
    estimatedWaitSec: Number(x.estimatedWaitSec ?? 0),
  };
}

export function publishTaskCreated(task: UnifiedTaskItem): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<UnifiedTaskItem>(JOB_EVENT_CREATED, { detail: task }));
}

export function publishTaskStatusChanged(task: UnifiedTaskItem): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<UnifiedTaskItem>(JOB_EVENT_STATUS_CHANGED, { detail: task }));
}

export async function fetchUnifiedTasks(limit = 30): Promise<UnifiedTaskItem[]> {
  const jobs = await fetchUnifiedJobs({ limit }).then((r) => r.items).catch(() => [] as UnifiedJobItem[]);
  return jobs
    .map(mapUnifiedTask)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, limit);
}

export async function fetchHeaderTasks(params?: {
  inProgressLimit?: number;
  completedLimit?: number;
  failedLimit?: number;
}): Promise<UnifiedTaskItem[]> {
  const inProgressLimit = Math.max(1, params?.inProgressLimit ?? 20);
  const completedLimit = Math.max(1, params?.completedLimit ?? 5);
  const failedLimit = Math.max(1, params?.failedLimit ?? 3);
  const [queued, processing, completed, failed] = await Promise.all([
    fetchUnifiedJobs({ limit: inProgressLimit, status: "queued" }).then((r) => r.items).catch(() => [] as UnifiedJobItem[]),
    fetchUnifiedJobs({ limit: inProgressLimit, status: "processing" }).then((r) => r.items).catch(() => [] as UnifiedJobItem[]),
    fetchUnifiedJobs({ limit: completedLimit, status: "completed" }).then((r) => r.items).catch(() => [] as UnifiedJobItem[]),
    fetchUnifiedJobs({ limit: failedLimit, status: "failed" }).then((r) => r.items).catch(() => [] as UnifiedJobItem[]),
  ]);

  const dedup = new Map<string, UnifiedTaskItem>();
  for (const job of [...queued, ...processing, ...completed, ...failed]) {
    const task = mapUnifiedTask(job);
    dedup.set(`${task.source}:${task.id}`, task);
  }
  return Array.from(dedup.values())
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, inProgressLimit * 2 + completedLimit + failedLimit);
}

export async function fetchUnifiedTasksWithFilter(params?: {
  limit?: number;
  source?: "all" | "import" | "merge-fields" | "export" | "clean-invalid" | "field-promotion";
  status?: "all" | "queued" | "processing" | "completed" | "failed";
}): Promise<UnifiedTaskItem[]> {
  const jobs = await fetchUnifiedJobs(params).then((r) => r.items).catch(() => [] as UnifiedJobItem[]);
  return jobs
    .map(mapUnifiedTask)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, params?.limit ?? 30);
}

export async function retryTaskIfImport(task: UnifiedTaskItem): Promise<boolean> {
  if (task.source !== "import") return false;
  await retryImportJob(task.id);
  return true;
}

export async function retryTaskIfExport(task: UnifiedTaskItem): Promise<boolean> {
  if (task.source !== "export") return false;
  await retryExportQueueJob(task.id);
  return true;
}

export function subscribeUnifiedTasks(
  params: {
    limit?: number;
    source?: "all" | "import" | "merge-fields" | "export" | "clean-invalid" | "field-promotion";
    status?: "all" | "queued" | "processing" | "completed" | "failed";
  },
  onItems: (items: UnifiedTaskItem[]) => void,
  onError?: (error: Event) => void
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const limit = params.limit ?? 100;
  let disposed = false;
  let es: EventSource | null = null;
  /** DOM `setTimeout` 回傳 number；避免與 NodeJS.Timeout 型別衝突 */
  let reconnectTimer: number | null = null;
  let attempt = 0;

  const applyItems = (items: UnifiedTaskItem[]) => {
    onItems(items.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, limit));
  };

  const handleMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(String(event.data || "{}")) as { items?: UnifiedJobItem[] };
      const items = Array.isArray(data.items) ? data.items.map(mapUnifiedTask) : [];
      applyItems(items);
    } catch {
      // ignore malformed stream payload
    }
  };

  const fallbackPoll = () => {
    void fetchUnifiedJobs({
      limit,
      source: params.source,
      status: params.status,
    })
      .then((r) => applyItems((r.items || []).map(mapUnifiedTask)))
      .catch(() => {
        /* ignore */
      });
  };

  const clearReconnect = () => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const connect = () => {
    if (disposed) return;
    es?.close();
    const sp = new URLSearchParams();
    sp.set("limit", String(limit));
    if (params.source) sp.set("source", params.source);
    if (params.status) sp.set("status", params.status);
    const next = new EventSource(`/api/jobs/stream?${sp.toString()}`);
    es = next;
    next.addEventListener("jobs", handleMessage as EventListener);
    next.onopen = () => {
      attempt = 0;
    };
    next.onerror = (event) => {
      onError?.(event);
      next.close();
      if (disposed) return;
      fallbackPoll();
      clearReconnect();
      const delayMs = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
      attempt += 1;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        if (!disposed) connect();
      }, delayMs);
    };
  };

  fallbackPoll();
  connect();

  return () => {
    disposed = true;
    clearReconnect();
    if (es) {
      es.removeEventListener("jobs", handleMessage as EventListener);
      es.close();
      es = null;
    }
  };
}
