import React, { useCallback, useEffect, useState } from "react";
import { Download, RotateCcw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  JOB_EVENT_CREATED,
  fetchUnifiedTasksWithFilter,
  retryTaskIfExport,
  retryTaskIfImport,
  subscribeUnifiedTasks,
  type UnifiedTaskItem,
} from "@/lib/jobCenter";
import {
  applyFieldPromotionCleanup,
  exportDownloadUrl,
  fetchFieldPromotionJob,
  fieldPromotionCleanupMismatchReportUrl,
  fetchJobResult,
  formatApiThrownError,
  jobResultFileDownloadUrl,
  previewFieldPromotionCleanup,
  scheduleFieldPromotionOnRestart,
  submitFieldPromotionRules,
  type FieldPromotionJobDetail,
} from "@/lib/dmsApi";

function humanizeTaskStatus(status: UnifiedTaskItem["status"]): string {
  if (status === "queued") return "等待排隊";
  if (status === "processing") return "執行中";
  if (status === "completed") return "已完成";
  return "執行失敗";
}

function humanizeTaskSubtitle(subtitle: string): string {
  const raw = String(subtitle || "").trim();
  if (!raw) return "-";
  if (raw === "api_restarted_mark_failed") return "服務重啟中斷，任務已停止";
  if (raw === "worker_restarted_mark_failed") return "背景服務重啟中斷，任務已停止";
  if (raw === "worker 執行失敗") return "背景執行失敗，請稍後重試";
  if (raw === "清理檢查中") return "正在檢查資料有效性";
  if (raw.startsWith("掃描中")) return raw.replace("掃描中", "掃描資料中");
  if (raw.startsWith("隔離中")) return raw.replace("隔離中", "正在移入隔離區");
  if (raw.startsWith("刪除中")) return raw.replace("刪除中", "正在刪除");
  return raw;
}

function humanizeFieldPromotionState(state?: UnifiedTaskItem["state"]): string {
  if (state === "rules-confirmed") return "規則已確認，準備產生升級計畫";
  if (state === "pending-maintenance") return "升級計畫已產生，待維護套用";
  if (state === "scheduled-on-restart") return "已排入下次重啟套用";
  if (state === "applying") return "固定欄位升級進行中";
  if (state === "applied") return "固定欄位升級已套用";
  if (state === "failed") return "欄位升級任務失敗";
  return "待確認欄位規則";
}

export const TaskCenterPage: React.FC = () => {
  const [tasks, setTasks] = useState<UnifiedTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | UnifiedTaskItem["status"]>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | UnifiedTaskItem["source"]>("all");
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);
  const [downloadingTaskId, setDownloadingTaskId] = useState<string | null>(null);
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [promotionSaving, setPromotionSaving] = useState(false);
  const [promotionScheduling, setPromotionScheduling] = useState(false);
  const [cleanupPreviewLoading, setCleanupPreviewLoading] = useState(false);
  const [cleanupApplying, setCleanupApplying] = useState(false);
  const [promotionTaskId, setPromotionTaskId] = useState<string | null>(null);
  const [promotionDetail, setPromotionDetail] = useState<FieldPromotionJobDetail | null>(null);
  const [promotionForm, setPromotionForm] = useState({
    type: "文字" as "文字" | "數字" | "日期" | "電子郵件" | "電話",
    allowNull: true,
    enableFilter: true,
    enableSort: false,
    writeAliases: true,
    purgeAttrsAfterPromotion: true,
    note: "",
  });
  const visibleTasks = tasks.filter(
    (task) => !(task.source === "field-promotion" && task.state === "applied" && task.cleanupDone)
  );
  const inProgressCount = visibleTasks.filter(
    (x) => x.status === "queued" || x.status === "processing"
  ).length;

  const loadTasks = useCallback(async () => {
    try {
      const list = await fetchUnifiedTasksWithFilter({
        limit: 200,
        source: sourceFilter,
        status: statusFilter,
      });
      setTasks(list);
    } finally {
      setLoading(false);
    }
  }, [sourceFilter, statusFilter]);

  useEffect(() => {
    void loadTasks();
    const unsubscribe = subscribeUnifiedTasks(
      { limit: 200, source: sourceFilter, status: statusFilter },
      (streamTasks) => {
        setTasks(streamTasks);
        setLoading(false);
      }
    );
    const onJobCreated = (event: Event) => {
      const created = (event as CustomEvent<UnifiedTaskItem>).detail;
      if (!created) return;
      setTasks((prev) =>
        [created, ...prev.filter((x) => !(x.id === created.id && x.source === created.source))]
          .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
          .slice(0, 200)
      );
    };
    window.addEventListener(JOB_EVENT_CREATED, onJobCreated as EventListener);
    return () => {
      unsubscribe();
      window.removeEventListener(JOB_EVENT_CREATED, onJobCreated as EventListener);
    };
  }, [loadTasks, sourceFilter, statusFilter]);

  useEffect(() => {
    const timer = window.setInterval(() => void loadTasks(), inProgressCount > 0 ? 1500 : 5000);
    return () => window.clearInterval(timer);
  }, [inProgressCount, loadTasks]);

  const handleRetry = async (task: UnifiedTaskItem) => {
    if (!(task.source === "import" && task.status === "failed" && task.canRetry)) return;
    try {
      setRetryingTaskId(task.id);
      await retryTaskIfImport(task);
      toast.success("已送出匯入重試");
      await loadTasks();
    } catch (e) {
      toast.error(formatApiThrownError(e, "重試失敗"));
    } finally {
      setRetryingTaskId(null);
    }
  };

  const handleRetryExport = async (task: UnifiedTaskItem) => {
    if (!(task.source === "export" && task.status === "failed")) return;
    try {
      setRetryingTaskId(task.id);
      await retryTaskIfExport(task);
      toast.success("已送出匯出重試");
      await loadTasks();
    } catch (e) {
      toast.error(formatApiThrownError(e, "重試失敗"));
    } finally {
      setRetryingTaskId(null);
    }
  };

  const handleDownloadExport = async (task: UnifiedTaskItem) => {
    if (!(task.source === "export" && task.status === "completed")) return;
    try {
      setDownloadingTaskId(task.id);
      const result = await fetchJobResult(task.id);
      const files = Array.isArray(result.result?.files)
        ? result.result?.files?.map((x) => String(x.fileName || "").trim()).filter(Boolean)
        : [];
      if (files.length > 0) {
        for (const fileName of files) {
          window.open(jobResultFileDownloadUrl(task.id, fileName), "_blank", "noopener,noreferrer");
        }
        if (files.length > 1) {
          toast.success(`已啟動 ${files.length} 個分檔下載`);
        }
        return;
      }
      const exportId = String(result.result?.exportId || "").trim();
      if (!exportId) {
        toast.error("找不到匯出檔資訊");
        return;
      }
      window.open(exportDownloadUrl(exportId), "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(formatApiThrownError(e, "下載失敗"));
    } finally {
      setDownloadingTaskId(null);
    }
  };

  const openPromotionDialog = async (task: UnifiedTaskItem) => {
    try {
      setPromotionDialogOpen(true);
      setPromotionLoading(true);
      setPromotionTaskId(task.id);
      const detail = await fetchFieldPromotionJob(task.id);
      setPromotionDetail(detail);
      setPromotionForm({
        type: detail.rules?.type || "文字",
        allowNull: detail.rules?.allowNull ?? true,
        enableFilter: detail.rules?.enableFilter ?? true,
        enableSort: detail.rules?.enableSort ?? false,
        writeAliases: detail.rules?.writeAliases ?? true,
        purgeAttrsAfterPromotion: detail.rules?.purgeAttrsAfterPromotion ?? true,
        note: detail.rules?.note || "",
      });
    } catch (e) {
      toast.error(formatApiThrownError(e, "無法載入欄位升級任務"));
      setPromotionDialogOpen(false);
    } finally {
      setPromotionLoading(false);
    }
  };

  const savePromotionRules = async () => {
    if (!promotionTaskId) return;
    try {
      setPromotionSaving(true);
      await submitFieldPromotionRules(promotionTaskId, promotionForm);
      toast.success("已確認欄位規則，系統會先產生 promotion plan");
      setPromotionDialogOpen(false);
      await loadTasks();
    } catch (e) {
      toast.error(formatApiThrownError(e, "儲存欄位規則失敗"));
    } finally {
      setPromotionSaving(false);
    }
  };

  const schedulePromotionRestart = async () => {
    if (!promotionTaskId) return;
    try {
      setPromotionScheduling(true);
      await scheduleFieldPromotionOnRestart(promotionTaskId);
      toast.success("已排入下次重啟套用");
      setPromotionDialogOpen(false);
      await loadTasks();
    } catch (e) {
      toast.error(formatApiThrownError(e, "排入下次重啟失敗"));
    } finally {
      setPromotionScheduling(false);
    }
  };

  const previewCleanup = async () => {
    if (!promotionTaskId) return;
    try {
      setCleanupPreviewLoading(true);
      await previewFieldPromotionCleanup(promotionTaskId);
      const detail = await fetchFieldPromotionJob(promotionTaskId);
      setPromotionDetail(detail);
      toast.success("已更新 attrs 清理預覽");
    } catch (e) {
      toast.error(formatApiThrownError(e, "取得清理預覽失敗"));
    } finally {
      setCleanupPreviewLoading(false);
    }
  };

  const applyCleanup = async () => {
    if (!promotionTaskId) return;
    if (!window.confirm("確認要清理 attrs 舊值嗎？只會移除與固定欄位一致的值。")) return;
    try {
      setCleanupApplying(true);
      await applyFieldPromotionCleanup(promotionTaskId);
      const detail = await fetchFieldPromotionJob(promotionTaskId);
      setPromotionDetail(detail);
      toast.success("已套用 attrs 清理");
    } catch (e) {
      toast.error(formatApiThrownError(e, "套用 attrs 清理失敗"));
    } finally {
      setCleanupApplying(false);
    }
  };

  const downloadCleanupMismatchReport = () => {
    if (!promotionTaskId) return;
    window.open(fieldPromotionCleanupMismatchReportUrl(promotionTaskId), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">任務中心</h2>
          <p className="text-xs text-gray-500">統一追蹤匯入與欄位合併任務，保留最近歷史</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}>
            <SelectTrigger className="w-36 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部來源</SelectItem>
              <SelectItem value="import">匯入</SelectItem>
              <SelectItem value="export">匯出</SelectItem>
              <SelectItem value="merge-fields">欄位合併</SelectItem>
              <SelectItem value="clean-invalid">清理無效</SelectItem>
              <SelectItem value="field-promotion">欄位升級</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-36 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態</SelectItem>
              <SelectItem value="queued">排隊中</SelectItem>
              <SelectItem value="processing">進行中</SelectItem>
              <SelectItem value="completed">已完成</SelectItem>
              <SelectItem value="failed">失敗</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void loadTasks()}>
            重新整理
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2 text-xs bg-gray-50 border-b text-gray-600">
          <div className="col-span-4">任務</div>
          <div className="col-span-2">來源</div>
          <div className="col-span-2">狀態</div>
          <div className="col-span-2">進度</div>
          <div className="col-span-2 text-right">操作</div>
        </div>
        {loading ? (
          <div className="px-4 py-6 text-sm text-gray-500">載入中…</div>
        ) : visibleTasks.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500">沒有符合條件的任務</div>
        ) : (
          visibleTasks.map((task) => {
            const isFieldPromotion = task.source === "field-promotion";
            const percent =
              task.totalRows > 0
                ? Math.min(100, Math.floor((task.processedRows / task.totalRows) * 100))
                : task.status === "completed"
                ? 100
                : task.status === "failed"
                ? 0
                : 12;
            return (
              <div key={`${task.source}-${task.id}`} className="grid grid-cols-12 px-4 py-3 text-xs border-b">
                <div className="col-span-4 min-w-0">
                  <div className="font-medium truncate">{task.title}</div>
                  <div className="text-gray-500 truncate">{humanizeTaskSubtitle(task.subtitle)}</div>
                </div>
                <div className="col-span-2">
                  {task.source === "import"
                    ? "匯入"
                    : task.source === "export"
                      ? "匯出"
                      : task.source === "clean-invalid"
                        ? "清理無效"
                        : task.source === "field-promotion"
                          ? "欄位升級"
                          : "欄位合併"}
                </div>
                <div className="col-span-2">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full ${
                      task.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : task.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {humanizeTaskStatus(task.status)}
                  </span>
                </div>
                <div className="col-span-2">
                  {isFieldPromotion ? (
                    <div className="text-gray-500">
                      {task.status === "processing"
                        ? "欄位升級處理中"
                        : humanizeFieldPromotionState(task.state)}
                    </div>
                  ) : (
                    <>
                      <div className="h-1.5 bg-gray-200 rounded overflow-hidden">
                        <div className="h-full bg-blue-600" style={{ width: `${percent}%` }} />
                      </div>
                      <div className="mt-1 text-gray-500">
                        {task.processedRows}/{task.totalRows || "?"}
                      </div>
                      {task.status === "queued" && (task.queuePosition || task.estimatedWaitSec) ? (
                        <div className="text-gray-500">排隊#{task.queuePosition || "?"} · 約{task.estimatedWaitSec || 0}s</div>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="col-span-2 text-right">
                  {task.source === "field-promotion" && task.state === "queued" ? (
                    <button
                      className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                      onClick={() => void openPromotionDialog(task)}
                    >
                      <Settings2 className="w-3 h-3" />
                      設定規則
                    </button>
                  ) : task.source === "field-promotion" && task.state === "pending-maintenance" ? (
                    <button
                      className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                      onClick={() => void openPromotionDialog(task)}
                    >
                      <Settings2 className="w-3 h-3" />
                      排入重啟
                    </button>
                  ) : task.source === "import" && task.status === "failed" && task.canRetry ? (
                    <button
                      className="inline-flex items-center gap-1 text-blue-700 hover:underline disabled:opacity-60"
                      disabled={retryingTaskId === task.id}
                      onClick={() => void handleRetry(task)}
                    >
                      <RotateCcw className="w-3 h-3" />
                      {retryingTaskId === task.id ? "重試中…" : "重試"}
                    </button>
                  ) : (
                    task.source === "export" && task.status === "completed" ? (
                      <button
                        className="inline-flex items-center gap-1 text-blue-700 hover:underline disabled:opacity-60"
                        disabled={downloadingTaskId === task.id}
                        onClick={() => void handleDownloadExport(task)}
                      >
                        <Download className="w-3 h-3" />
                        {downloadingTaskId === task.id ? "取得中…" : "下載"}
                      </button>
                    ) : task.source === "export" && task.status === "failed" ? (
                      <button
                        className="inline-flex items-center gap-1 text-blue-700 hover:underline disabled:opacity-60"
                        disabled={retryingTaskId === task.id}
                        onClick={() => void handleRetryExport(task)}
                      >
                        <RotateCcw className="w-3 h-3" />
                        {retryingTaskId === task.id ? "重試中…" : "重試"}
                      </button>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      <Dialog open={promotionDialogOpen} onOpenChange={setPromotionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>欄位升級規則</DialogTitle>
            <DialogDescription>
              先確認升級規則，再由你決定是否排入下次重啟套用。若自動升級失敗，系統會保留白話摘要與技術細節供回報。
            </DialogDescription>
          </DialogHeader>
          {promotionLoading ? (
            <div className="text-sm text-gray-500">載入中…</div>
          ) : !promotionDetail ? (
            <div className="text-sm text-gray-500">找不到任務內容</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border bg-gray-50 p-3 text-xs">
                <div className="font-medium">{promotionDetail.title}</div>
                <div className="text-gray-500 mt-1">{promotionDetail.subtitle}</div>
                {promotionDetail.scheduledForRestartAt ? (
                  <div className="text-gray-500 mt-1">
                    已排入下次重啟：{new Date(promotionDetail.scheduledForRestartAt).toLocaleString()}
                  </div>
                ) : null}
                {promotionDetail.lastError?.summary ? (
                  <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-red-700 space-y-1">
                    <div>{promotionDetail.lastError.summary}</div>
                    {promotionDetail.lastError.technicalDetail || promotionDetail.technicalError ? (
                      <div className="font-mono text-[11px] break-all">
                        {promotionDetail.lastError.technicalDetail || promotionDetail.technicalError}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {promotionDetail.result?.state === "applied" ? (
                  <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 space-y-1">
                    <div>
                      升級完成：{promotionDetail.result?.appliedColumns?.length || 0} 個欄位，回填{" "}
                      {promotionDetail.result?.totalBackfilledRows || 0} 筆資料
                    </div>
                    {(promotionDetail.result?.applyReport || []).map((item) => (
                      <div key={`${item.key}-${item.column}`} className="text-[11px] font-mono">
                        {item.key} → {item.column} / backfilled={item.backfilledRows}
                      </div>
                    ))}
                  </div>
                ) : null}
                {promotionDetail.cleanup?.lastPreview ? (
                  <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-amber-700 space-y-1">
                    <div>
                      清理預覽：attrs 共 {promotionDetail.cleanup.lastPreview.totals.totalWithAttr} 筆，
                      可安全移除 {promotionDetail.cleanup.lastPreview.totals.matchedPromoted} 筆，
                      不一致 {promotionDetail.cleanup.lastPreview.totals.mismatch} 筆
                    </div>
                    {promotionDetail.cleanup.lastPreview.totals.mismatch > 0 ? (
                      <div className="text-red-700">
                        發現不一致資料，請先人工檢查後再清理（目前會先鎖住清理按鈕）。
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {promotionDetail.cleanup?.lastApplied ? (
                  <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 space-y-1">
                    <div>attrs 清理完成：移除 {promotionDetail.cleanup.lastApplied.totalRemovedRows} 筆舊值</div>
                  </div>
                ) : null}
                <div className="mt-2 space-y-2">
                  {promotionDetail.fields.map((f) => (
                    <div key={f.key} className="rounded border bg-white p-2">
                      <div className="font-mono">{f.key} / {f.name}</div>
                      <div className="text-gray-500">來源表頭：{f.sourceHeader || "-"}</div>
                      <div className="text-gray-500">樣本：{f.sampleValues.join(" / ") || "-"}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>欄位型別</Label>
                  <Select value={promotionForm.type} onValueChange={(v) => setPromotionForm((s) => ({ ...s, type: v as typeof s.type }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="文字">文字</SelectItem>
                      <SelectItem value="數字">數字</SelectItem>
                      <SelectItem value="日期">日期</SelectItem>
                      <SelectItem value="電子郵件">電子郵件</SelectItem>
                      <SelectItem value="電話">電話</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>備註</Label>
                  <Input value={promotionForm.note} onChange={(e) => setPromotionForm((s) => ({ ...s, note: e.target.value }))} placeholder="例如：下次維護窗建立索引" />
                </div>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                {[
                  ["allowNull", "允許空值"],
                  ["enableFilter", "升級後允許篩選"],
                  ["enableSort", "升級後允許排序"],
                  ["writeAliases", "記住這次的欄位名稱，之後自動對應"],
                  ["purgeAttrsAfterPromotion", "升級完成後，移除舊的自訂欄資料，避免重複保存"],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <Label htmlFor={key} className="text-sm">{label}</Label>
                    <Switch
                      id={key}
                      checked={Boolean(promotionForm[key as keyof typeof promotionForm])}
                      onCheckedChange={(checked) =>
                        setPromotionForm((s) => ({ ...s, [key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPromotionDialogOpen(false)}
                  disabled={promotionSaving || promotionScheduling}
                >
                  取消
                </Button>
                {promotionDetail.state === "queued" ? (
                  <Button onClick={() => void savePromotionRules()} disabled={promotionSaving}>
                    {promotionSaving ? "儲存中…" : "確認規則"}
                  </Button>
                ) : null}
                {(promotionDetail.state === "pending-maintenance" ||
                  promotionDetail.state === "failed") ? (
                  <Button onClick={() => void schedulePromotionRestart()} disabled={promotionScheduling}>
                    {promotionScheduling ? "排程中…" : "下次重啟套用"}
                  </Button>
                ) : null}
                {promotionDetail.state === "applied" ? (
                  <>
                    <Button variant="outline" onClick={() => void previewCleanup()} disabled={cleanupPreviewLoading}>
                      {cleanupPreviewLoading ? "載入中…" : "預覽 attrs 清理"}
                    </Button>
                    {(promotionDetail.cleanup?.lastPreview?.totals.mismatch || 0) > 0 ? (
                      <Button variant="outline" onClick={() => downloadCleanupMismatchReport()}>
                        下載 mismatch 明細
                      </Button>
                    ) : null}
                    <Button
                      onClick={() => void applyCleanup()}
                      disabled={
                        cleanupApplying ||
                        (promotionDetail.cleanup?.lastPreview?.totals.mismatch || 0) > 0
                      }
                    >
                      {cleanupApplying ? "清理中…" : "確認清理 attrs"}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
