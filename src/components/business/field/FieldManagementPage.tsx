import React, { useEffect, useState } from "react";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { FieldManagementTab, GroupManagementTab, Field } from './components';
import {
  applyFieldPromotionCleanup,
  createFieldGroup,
  createFieldDefinition,
  deleteFieldGroup,
  deleteFieldDefinition,
  fetchFieldDefinitions,
  fetchFieldGroups,
  patchFieldGroup,
  patchFieldDefinition,
  fetchFieldPromotionJob,
  fieldPromotionCleanupMismatchReportUrl,
  previewFieldPromotionCleanup,
  submitFieldPromotionRules,
  scheduleFieldPromotionOnRestart,
  formatApiThrownError,
  OPEN_MODULE_EVENT,
  type FieldPromotionJobDetail,
  type FieldGroupDTO,
} from "@/lib/dmsApi";
import { fetchUnifiedTasksWithFilter, subscribeUnifiedTasks, type UnifiedTaskItem } from "@/lib/jobCenter";
import { toast } from "sonner";

function fieldPromotionStateLabel(state?: UnifiedTaskItem["state"]): string {
  if (state === "rules-confirmed") return "規則已確認";
  if (state === "pending-maintenance") return "待維護套用";
  if (state === "scheduled-on-restart") return "已排入重啟";
  if (state === "applying") return "套用中";
  if (state === "applied") return "已套用";
  if (state === "failed") return "失敗";
  return "待確認";
}

export const FieldManagementPage: React.FC = () => {
  const [fields, setFields] = useState<Field[]>([]);
  const [groups, setGroups] = useState<FieldGroupDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  const [promotionTasks, setPromotionTasks] = useState<UnifiedTaskItem[]>([]);
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
    enableSort: true,
    writeAliases: true,
    purgeAttrsAfterPromotion: true,
    note: "",
  });
  const visiblePromotionTasks = promotionTasks.filter(
    (task) => !(task.source === "field-promotion" && task.state === "applied" && task.cleanupDone)
  );

  const load = async () => {
    setLoading(true);
    try {
      const [{ items: fds }, { items: gds }] = await Promise.all([
        fetchFieldDefinitions(),
        fetchFieldGroups().catch(() => ({ items: [] as FieldGroupDTO[] })),
      ]);
      setGroups(gds);
      setFields(
        fds.map((f) => ({
          id: f.id,
          key: f.key,
          name: f.name,
          uiColor: f.uiColor,
          type: f.type,
          category: f.category,
          aliases: f.aliases,
          source: f.source,
          isRequired: f.isRequired,
          isSystem: f.isSystem,
          defaultVisible: f.defaultVisible,
          isExportable: f.isExportable,
          sortOrder: f.sortOrder,
          group: f.group,
          groupId: f.groupId,
          storageMode: f.storageMode,
          promotionStatus: f.promotionStatus,
          promotionJobId: f.promotionJobId,
          promotionSourceHeader: f.promotionSourceHeader,
          promotionRules: f.promotionRules,
          promotionPlan: f.promotionPlan,
          promotionUpdatedAt: f.promotionUpdatedAt,
        }))
      );
    } catch (e) {
      toast.error(formatApiThrownError(e, "無法載入欄位定義"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    void fetchUnifiedTasksWithFilter({
      limit: 50,
      source: "field-promotion",
      status: "all",
    }).then(setPromotionTasks).catch(() => {});
    const unsubscribe = subscribeUnifiedTasks(
      { limit: 50, source: "field-promotion", status: "all" },
      (items) => setPromotionTasks(items)
    );
    return () => unsubscribe();
  }, []);

  const handleCreate = async (data: { name: string; type: string; groupId: string | null; isRequired: boolean }) => {
    try {
      await createFieldDefinition({
        name: data.name,
        type: data.type,
        isRequired: data.isRequired,
        groupId: data.groupId,
        defaultVisible: true,
      });
      toast.success("已新增欄位");
      await load();
    } catch (e) {
      toast.error(formatApiThrownError(e, "新增失敗"));
    }
  };

  const handlePatch = async (fieldId: string, updatedField: Partial<Field>) => {
    try {
      await patchFieldDefinition(fieldId, {
        name: updatedField.name,
        uiColor: updatedField.uiColor,
        type: updatedField.type,
        category: updatedField.category,
        aliases: updatedField.aliases,
        source: updatedField.source,
        isRequired: updatedField.isRequired,
        defaultVisible: updatedField.defaultVisible,
        isExportable: updatedField.isExportable,
        sortOrder: updatedField.sortOrder,
        groupId: updatedField.groupId,
      });
      toast.success("已儲存");
      await load();
    } catch (e) {
      toast.error(formatApiThrownError(e, "儲存失敗"));
    }
  };

  const handleDelete = async (fieldId: string) => {
    const f = fields.find((x) => x.id === fieldId);
    if (!f) return;
    if (f.isSystem) {
      toast.error("系統欄位不可刪除");
      return;
    }
    if (!window.confirm(`刪除欄位「${f.name}」？（不會自動清除既有資料）`)) return;
    try {
      await deleteFieldDefinition(fieldId);
      toast.success("已刪除");
      await load();
    } catch (e) {
      toast.error(formatApiThrownError(e, "刪除失敗"));
    }
  };

  const handleReorder = async (ordered: Array<{ id: string; sortOrder: number }>) => {
    try {
      await Promise.all(
        ordered.map(({ id, sortOrder }) => patchFieldDefinition(id, { sortOrder }))
      );
      await load();
    } catch (e) {
      toast.error(formatApiThrownError(e, "排序更新失敗"));
    }
  };

  const handleCreateGroup = async (data: { name: string; color: string }) => {
    try {
      await createFieldGroup(data);
      toast.success("已新增分組");
      await load();
    } catch (e) {
      toast.error(formatApiThrownError(e, "新增分組失敗"));
    }
  };

  const handlePatchGroup = async (id: string, data: { name: string; color: string }) => {
    try {
      await patchFieldGroup(id, data);
      toast.success("已更新分組");
      await load();
    } catch (e) {
      toast.error(formatApiThrownError(e, "更新分組失敗"));
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      await deleteFieldGroup(id);
      toast.success("已刪除分組");
      await load();
    } catch (e) {
      toast.error(formatApiThrownError(e, "刪除分組失敗（可能仍有欄位綁定）"));
    }
  };

  const goToDataManagement = () => {
    window.dispatchEvent(new CustomEvent(OPEN_MODULE_EVENT, { detail: { module: "data-management" } }));
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

  const refreshPromotionTasks = async () => {
    const items = await fetchUnifiedTasksWithFilter({
      limit: 50,
      source: "field-promotion",
      status: "all",
    });
    setPromotionTasks(items);
  };

  const savePromotionRules = async () => {
    if (!promotionTaskId) return;
    try {
      setPromotionSaving(true);
      await submitFieldPromotionRules(promotionTaskId, promotionForm);
      toast.success("已確認欄位規則，系統會先產生 promotion plan");
      setPromotionDialogOpen(false);
      await refreshPromotionTasks();
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
      await refreshPromotionTasks();
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
      toast.success("已套用 attrs 清理");
      setPromotionDialogOpen(false);
      await refreshPromotionTasks();
      await load();
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
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-gray-50/80 dark:bg-gray-900/40 dark:border-gray-700 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400 min-w-0">
          <span className="font-medium text-gray-800 dark:text-gray-200">欄位定義</span>
          會影響<strong className="mx-1">資料管理</strong>表格欄位、篩選下拉與匯出欄位；變更後主表會依設定重新載入。
        </div>
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={goToDataManagement}>
          前往資料管理
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="min-w-0">
          <FieldManagementTab
            dataLoading={loading}
            fields={fields}
            groups={groups.map((g) => ({ ...g }))}
            onNavigateToGroupManagement={() => setGroupManagerOpen(true)}
            onCreate={handleCreate}
            onPatch={handlePatch}
            onDelete={handleDelete}
            onReorder={handleReorder}
          />
        </div>

        <aside className="rounded-lg border bg-white p-4 space-y-4 min-h-[32rem] xl:h-[35.55rem] xl:sticky xl:top-4 flex flex-col">
          <div>
            <h3 className="text-sm font-semibold">待升級欄位</h3>
            <p className="text-xs text-gray-500 mt-1">
              匯入新增的動態欄位會先出現在這裡。先補齊規則，再由你逐任務排入下次重啟套用。
            </p>
          </div>

          {visiblePromotionTasks.length === 0 ? (
            <div className="text-xs text-gray-500 rounded-md border border-dashed p-4 flex-1">
              目前沒有待處理的欄位升級任務。
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto pr-1">
              {visiblePromotionTasks.map((task) => (
                <div key={task.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{task.title}</div>
                      <div className="text-xs text-gray-500">{task.subtitle || "-"}</div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 inline-flex rounded-full px-2 py-0.5 text-[11px]",
                        task.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : task.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                      )}
                    >
                      {task.status === "processing" ? "處理中" : fieldPromotionStateLabel(task.state)}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    建立時間：{new Date(task.createdAt).toLocaleString()}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant={task.state === "queued" ? "default" : "outline"}
                      onClick={() => void openPromotionDialog(task)}
                    >
                      {task.state === "queued"
                        ? "設定規則"
                        : task.state === "pending-maintenance"
                          ? "排入重啟"
                          : "查看規則"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <Dialog open={groupManagerOpen} onOpenChange={setGroupManagerOpen}>
        <DialogContent
          className={cn(
            "flex min-h-0 max-h-[min(85vh,680px)] w-[min(100vw-2rem,42rem)] max-w-3xl flex-col gap-0 overflow-hidden",
            "border-0 bg-transparent p-5 shadow-none sm:p-6",
            "[&>button]:z-[2] [&>button]:border [&>button]:border-gray-200/80 [&>button]:bg-white/90 [&>button]:shadow-sm dark:[&>button]:border-gray-700 dark:[&>button]:bg-gray-900/90"
          )}
        >
          {/* 僅無障礙朗讀；畫面呈現以內嵌面板為主（對齊「圖二」單一面板） */}
          <DialogTitle className="sr-only">管理分組</DialogTitle>
          {/* 外層留白＋白底，讓主面板與遮罩之間有呼吸感（不貼邊） */}
          <div className="box-border flex min-h-0 max-h-full flex-1 flex-col overflow-hidden rounded-2xl bg-gray-200 p-3 shadow-xl ring-1 ring-gray-200 dark:bg-gray-200 dark:ring-gray-200 sm:p-4">
            <GroupManagementTab
              dataLoading={loading}
              groups={groups.map((g) => ({
                ...g,
                fieldCount: fields.filter((f) => f.groupId === g.id).length,
              }))}
              onCreate={handleCreateGroup}
              onPatch={handlePatchGroup}
              onDelete={handleDeleteGroup}
            />
          </div>
        </DialogContent>
      </Dialog>

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
                    <Label htmlFor={`field-management-${key}`} className="text-sm">{label}</Label>
                    <Switch
                      id={`field-management-${key}`}
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