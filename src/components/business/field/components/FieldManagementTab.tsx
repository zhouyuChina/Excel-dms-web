import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Edit2, Eye, EyeOff, Layers, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Field = {
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

export type FieldGroup = {
  id: string;
  name: string;
  color: string;
  isSystem: boolean;
  sortOrder: number;
};

interface FieldManagementTabProps {
  fields: Field[];
  groups: FieldGroup[];
  dataLoading?: boolean;
  onNavigateToGroupManagement?: () => void;
  onCreate: (data: { name: string; type: string; groupId: string | null; isRequired: boolean }) => Promise<void>;
  onPatch: (fieldId: string, updatedField: Partial<Field>) => Promise<void>;
  onDelete: (fieldId: string) => Promise<void>;
  onReorder: (ordered: Array<{ id: string; sortOrder: number }>) => Promise<void>;
}

const FIELD_TAG_SELECTION_STORAGE_KEY = "field-management:selected-field-tag-ids:v1";

function groupColorDotClass(color: string): string {
  if (color.startsWith("bg-")) return color;
  const colorMap: Record<string, string> = {
    purple: "bg-purple-500",
    blue: "bg-blue-500",
    green: "bg-green-500",
    orange: "bg-orange-500",
    red: "bg-red-500",
    cyan: "bg-cyan-500",
    yellow: "bg-yellow-500",
    pink: "bg-pink-500",
  };
  return colorMap[color] || "bg-gray-400";
}

function toEditable(field: Field): Field {
  return {
    ...field,
    aliases: Array.isArray(field.aliases) ? field.aliases : [],
  };
}

function promotionStatusLabel(status: string): string | null {
  if (status === "queued") return "待確認升級規則";
  if (status === "rules-confirmed") return "規則已確認";
  if (status === "pending-maintenance") return "已產生 promotion plan";
  if (status === "failed") return "promotion 失敗";
  return null;
}

export const FieldManagementTab: React.FC<FieldManagementTabProps> = ({
  fields,
  groups,
  dataLoading = false,
  onNavigateToGroupManagement,
  onCreate,
  onPatch,
  onDelete,
  onReorder,
}) => {
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("文字");
  const [newFieldGroupId, setNewFieldGroupId] = useState<string>("none");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [selectedFieldTagIds, setSelectedFieldTagIds] = useState<string[]>([]);
  const [draftById, setDraftById] = useState<Record<string, Field>>({});
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [selectionHydrated, setSelectionHydrated] = useState(false);
  const [draggedTagIndex, setDraggedTagIndex] = useState<number | null>(null);
  const [previewTagOrderIds, setPreviewTagOrderIds] = useState<string[] | null>(null);
  const suppressTagClickRef = useRef(false);

  const sortedGroups = useMemo(() => [...groups].sort((a, b) => a.sortOrder - b.sortOrder), [groups]);
  const groupOptions = useMemo(
    () => [{ id: "none", name: "無分組" }, ...sortedGroups.map((g) => ({ id: g.id, name: g.name }))],
    [sortedGroups]
  );

  const listRows = useMemo(() => fields.filter((f) => selectedFieldTagIds.includes(f.id)), [fields, selectedFieldTagIds]);

  useEffect(() => {
    setDraftById((prev) => {
      const next = { ...prev };
      for (const f of fields) {
        if (!next[f.id]) next[f.id] = toEditable(f);
      }
      return next;
    });
  }, [fields]);

  useEffect(() => {
    if (selectionHydrated) return;
    const raw = localStorage.getItem(FIELD_TAG_SELECTION_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    const valid = parsed.filter((id) => fields.some((f) => f.id === id));
    if (valid.length > 0) {
      setSelectedFieldTagIds(valid);
      setSelectionHydrated(true);
      return;
    }

    const systemGroupIds = new Set(groups.filter((g) => g.isSystem).map((g) => g.id));
    const fallbackIds = fields
      .filter((f) => (f.groupId ? systemGroupIds.has(f.groupId) : false) || f.isSystem)
      .map((f) => f.id);
    setSelectedFieldTagIds(fallbackIds);
    setSelectionHydrated(true);
  }, [fields, groups, selectionHydrated]);

  useEffect(() => {
    if (!selectionHydrated) return;
    localStorage.setItem(FIELD_TAG_SELECTION_STORAGE_KEY, JSON.stringify(selectedFieldTagIds));
  }, [selectedFieldTagIds, selectionHydrated]);

  useEffect(() => {
    if (!editingRowId) return;
    if (!listRows.some((f) => f.id === editingRowId)) setEditingRowId(null);
  }, [editingRowId, listRows]);

  const handleAddField = async () => {
    if (!newFieldName.trim()) return;
    await onCreate({
      name: newFieldName.trim(),
      type: newFieldType,
      groupId: newFieldGroupId === "none" ? null : newFieldGroupId,
      isRequired: newFieldRequired,
    });
    setNewFieldName("");
    setNewFieldType("文字");
    setNewFieldGroupId("none");
    setNewFieldRequired(false);
  };

  const handleEditFieldChange = (fieldId: string, key: keyof Field, value: unknown) => {
    setDraftById((prev) => {
      const current = prev[fieldId];
      if (!current) return prev;
      return {
        ...prev,
        [fieldId]: {
          ...current,
          [key]: value as never,
        },
      };
    });
  };

  const isRowDirty = (field: Field) => {
    const draft = draftById[field.id];
    if (!draft) return false;
    return JSON.stringify(toEditable(field)) !== JSON.stringify(toEditable(draft));
  };

  const saveOne = async (field: Field) => {
    const draft = draftById[field.id];
    if (!draft) return;
    await onPatch(field.id, draft);
  };

  const cancelOne = (field: Field) => {
    setDraftById((prev) => ({ ...prev, [field.id]: toEditable(field) }));
  };

  const deleteOne = async (field: Field) => {
    await onDelete(field.id);
  };

  const toggleFieldTag = (fieldId: string) => {
    if (suppressTagClickRef.current) {
      suppressTagClickRef.current = false;
      return;
    }
    setSelectedFieldTagIds((prev) => (prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]));
  };

  const handleTagDragStart = (e: React.DragEvent, index: number) => {
    setDraggedTagIndex(index);
    setPreviewTagOrderIds(fields.map((f) => f.id));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleTagDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedTagIndex === null) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const side: "left" | "right" = e.clientX - rect.left < rect.width / 2 ? "left" : "right";
    const current = previewTagOrderIds ?? fields.map((f) => f.id);
    const sourceId = current[draggedTagIndex];
    if (!sourceId) return;
    const without = current.filter((id) => id !== sourceId);
    let insertIndex = index + (side === "right" ? 1 : 0);
    insertIndex = Math.max(0, Math.min(insertIndex, without.length));
    const next = [...without.slice(0, insertIndex), sourceId, ...without.slice(insertIndex)];
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      setPreviewTagOrderIds(next);
      setDraggedTagIndex(next.indexOf(sourceId));
    }
    e.dataTransfer.dropEffect = "move";
  };

  const handleTagDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedTagIndex === null) {
      setDraggedTagIndex(null);
      setPreviewTagOrderIds(null);
      return;
    }
    const finalOrderIds = previewTagOrderIds ?? fields.map((f) => f.id);
    const currentOrderIds = fields.map((f) => f.id);
    if (JSON.stringify(finalOrderIds) === JSON.stringify(currentOrderIds)) {
      setDraggedTagIndex(null);
      setPreviewTagOrderIds(null);
      return;
    }
    const fieldMap = new Map(fields.map((f) => [f.id, f]));
    const reordered = finalOrderIds.map((id) => fieldMap.get(id)).filter((f): f is Field => Boolean(f));
    suppressTagClickRef.current = true;
    await onReorder(reordered.map((f, idx) => ({ id: f.id, sortOrder: idx })));
    setDraggedTagIndex(null);
    setPreviewTagOrderIds(null);
  };

  const handleTagDragEnd = () => {
    setDraggedTagIndex(null);
    setPreviewTagOrderIds(null);
  };

  const getGroupFieldIds = (key: string) => {
    if (key === "__all__") return fields.map((f) => f.id);
    if (key === "__ungrouped__") return fields.filter((f) => !f.groupId).map((f) => f.id);
    return fields.filter((f) => f.groupId === key).map((f) => f.id);
  };

  const handleGroupChipToggle = (key: string) => {
    const ids = getGroupFieldIds(key);
    if (ids.length === 0) return;

    if (key === "__all__") {
      const isAllOn = fields.length > 0 && fields.every((f) => selectedFieldTagIds.includes(f.id));
      setSelectedFieldTagIds(isAllOn ? [] : fields.map((f) => f.id));
      return;
    }

    const allOn = ids.every((id) => selectedFieldTagIds.includes(id));
    if (allOn) {
      setSelectedFieldTagIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedFieldTagIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const selectedTagCount = selectedFieldTagIds.length;
  const isAllGroupOn = fields.length > 0 && fields.every((f) => selectedFieldTagIds.includes(f.id));
  const tagRenderOrder = useMemo(() => {
    const map = new Map(fields.map((f) => [f.id, f]));
    const ids = previewTagOrderIds ?? fields.map((f) => f.id);
    return ids.map((id) => map.get(id)).filter((f): f is Field => Boolean(f));
  }, [fields, previewTagOrderIds]);

  if (dataLoading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950/40 shadow-sm overflow-hidden">
        <div className="h-11 bg-gray-100 dark:bg-gray-800 animate-pulse border-b border-gray-200 dark:border-gray-700" />
        <div className="p-3 space-y-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
          <div className="h-8 max-w-md bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
          <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
        </div>
        <div className="p-2 space-y-1.5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-9 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950/40 shadow-sm overflow-hidden">
      <div className="border-b border-gray-200 dark:border-gray-700 px-3 py-3 bg-gray-50/90 dark:bg-gray-900/40">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="min-w-[140px] flex-1">
            <Input
              placeholder="新增欄位名稱"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
              className="h-9"
            />
          </div>
          <Select value={newFieldType} onValueChange={setNewFieldType}>
            <SelectTrigger className="w-[118px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="文字">文字</SelectItem>
              <SelectItem value="數字">數字</SelectItem>
              <SelectItem value="日期">日期</SelectItem>
              <SelectItem value="電子郵件">電子郵件</SelectItem>
              <SelectItem value="電話">電話</SelectItem>
            </SelectContent>
          </Select>
          <Select value={newFieldGroupId} onValueChange={setNewFieldGroupId}>
            <SelectTrigger className="w-[128px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groupOptions.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 shrink-0 pb-1.5">
            <input
              type="checkbox"
              checked={newFieldRequired}
              onChange={(e) => setNewFieldRequired(e.target.checked)}
              className="rounded border-gray-300 text-black focus:ring-gray-500"
            />
            必填
          </label>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleAddField()}
            className="h-9 bg-gray-800 text-white hover:bg-gray-900 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-white"
            disabled={!newFieldName.trim()}
          >
            <Plus className="w-4 h-4 mr-1" />
            建立
          </Button>
        </div>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 px-3 py-2.5 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">欄位清單</span>
            <span className="text-[11px] tabular-nums text-gray-600 dark:text-gray-400 bg-white/80 dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-600 rounded px-1.5 py-0.5">
              全部 {fields.length} 筆 · 標籤顯示 {selectedTagCount} 筆 · 列表 {listRows.length} 筆
            </span>
          </div>
          {onNavigateToGroupManagement ? (
            <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 text-xs" onClick={onNavigateToGroupManagement}>
              <Layers className="w-3.5 h-3.5" />
              管理分組
            </Button>
          ) : null}
        </div>

        {/* 分組標籤：B 模式（點一下只看該組，再點恢復） */}
        <div className="min-w-0 flex items-center gap-2 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => handleGroupChipToggle("__all__")}
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors shrink-0",
              isAllGroupOn
                ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            )}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => handleGroupChipToggle("__ungrouped__")}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors shrink-0",
              getGroupFieldIds("__ungrouped__").length > 0 &&
                getGroupFieldIds("__ungrouped__").every((id) => selectedFieldTagIds.includes(id))
                ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                : "border-dashed border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900/60 dark:text-gray-200"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
            未分組
          </button>
          {sortedGroups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => handleGroupChipToggle(g.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors shrink-0 max-w-[140px]",
                getGroupFieldIds(g.id).length > 0 && getGroupFieldIds(g.id).every((id) => selectedFieldTagIds.includes(id))
                  ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              )}
              title={g.name}
            >
              <span className={cn("w-2 h-2 rounded-full shrink-0", groupColorDotClass(g.color))} />
              <span className="truncate">{g.name}</span>
            </button>
          ))}
        </div>

        {/* 欄位標籤：多選，控制主列表可見欄位（樣式對齊資料管理） */}
        <div className="min-w-0 flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-0.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300/90 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600/90 [&::-webkit-scrollbar-track]:bg-transparent">
          <div className="flex gap-2">
            {tagRenderOrder.map((field, index) => {
              const selected = selectedFieldTagIds.includes(field.id);
              const groupColor = groupColorDotClass(groups.find((g) => g.id === field.groupId)?.color || "bg-gray-400");
              return (
                <button
                  key={field.id}
                  type="button"
                  draggable
                  onDragStart={(e) => handleTagDragStart(e, index)}
                  onDragOver={(e) => handleTagDragOver(e, index)}
                  onDrop={(e) => void handleTagDrop(e)}
                  onDragEnd={handleTagDragEnd}
                  onClick={() => toggleFieldTag(field.id)}
                  className={cn(
                    "relative flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-all whitespace-nowrap",
                    draggedTagIndex === index ? "opacity-40" : "",
                    selected
                      ? "bg-gray-900 dark:bg-gray-200 text-white dark:text-gray-900"
                      : "bg-gray-200 dark:bg-gray-900 opacity-50 hover:opacity-80"
                  )}
                  title={field.name}
                >
                  <span className={cn("w-2 h-2 rounded-full", groupColor)} />
                  {selected ? <Eye size={14} className="text-gray-50 dark:text-gray-900" /> : <EyeOff size={14} className="text-muted-foreground" />}
                  <span>{field.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between px-3 py-2 border-y border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/40">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">編輯列（依目前分組 / 搜尋結果）</div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-2.5 text-xs"
              disabled={selectedFieldTagIds.length === 0}
              onClick={() => setSelectedFieldTagIds([])}
            >
              清空欄位標籤
            </Button>
          </div>

        <div className="overflow-auto max-h-[calc(2.5rem+5*3.5rem)]">
            {listRows.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                目前沒有已選取的欄位標籤，請在上方勾選欄位或分組。
              </p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="sticky top-0 bg-white/95 dark:bg-gray-950/95 border-b border-gray-200 dark:border-gray-700 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="px-2 py-2 min-w-[180px]">名稱</th>
                    <th className="w-[120px] px-2 py-2">類型</th>
                    <th className="w-[140px] px-2 py-2">分組</th>
                    <th className="min-w-[200px] px-2 py-2">別名</th>
                    <th className="w-[220px] px-2 py-2 whitespace-nowrap">狀態</th>
                    <th className="w-[120px] px-2 py-2 pr-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {listRows.map((field) => {
                    const draft = draftById[field.id] || toEditable(field);
                    const dirty = isRowDirty(field);
                    const editing = editingRowId === field.id;
                    return (
                      <tr
                        key={field.id}
                        onDoubleClick={() => setEditingRowId(field.id)}
                        className={cn(
                          "hover:bg-gray-50/80 dark:hover:bg-gray-900/40",
                          "cursor-default",
                          dirty && "bg-amber-50/40 dark:bg-amber-950/10"
                        )}
                      >
                        <td className="px-2 py-2 align-middle">
                          {editing ? (
                            <>
                              <Input
                                value={draft.name || ""}
                                onChange={(e) => handleEditFieldChange(field.id, "name", e.target.value)}
                                className="h-8"
                              />
                            </>
                          ) : (
                            <>
                              <div className="font-medium text-gray-900 dark:text-gray-100">{field.name}</div>
                              {promotionStatusLabel(field.promotionStatus) ? (
                                <div className="mt-1">
                                  <Badge variant="secondary" className="text-[10px]">
                                    {promotionStatusLabel(field.promotionStatus)}
                                  </Badge>
                                </div>
                              ) : null}
                            </>
                          )}
                        </td>
                        <td className="px-2 py-2 align-middle">
                          {editing ? (
                            <Select value={draft.type || "文字"} onValueChange={(value) => handleEditFieldChange(field.id, "type", value)}>
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="文字">文字</SelectItem>
                                <SelectItem value="數字">數字</SelectItem>
                                <SelectItem value="日期">日期</SelectItem>
                                <SelectItem value="電子郵件">電子郵件</SelectItem>
                                <SelectItem value="電話">電話</SelectItem>
                                <SelectItem value="系統">系統</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {field.type || "—"}
                            </Badge>
                          )}
                        </td>
                        <td className="px-2 py-2 align-middle">
                          {editing ? (
                            <Select
                              value={draft.groupId ?? "none"}
                              onValueChange={(value) => handleEditFieldChange(field.id, "groupId", value === "none" ? null : value)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {groupOptions.map((g) => (
                                  <SelectItem key={g.id} value={g.id}>
                                    {g.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                              {field.groupId ? (
                                <span
                                  className={cn(
                                    "w-2 h-2 rounded-full shrink-0",
                                    groupColorDotClass(groups.find((g) => g.id === field.groupId)?.color || "")
                                  )}
                                />
                              ) : null}
                              {field.group || "未分組"}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 align-middle">
                          {editing ? (
                            <Input
                              value={Array.isArray(draft.aliases) ? (draft.aliases as unknown[]).join(", ") : ""}
                              onChange={(e) =>
                                handleEditFieldChange(
                                  field.id,
                                  "aliases",
                                  e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                )
                              }
                              className="h-8"
                              placeholder="逗號分隔別名"
                            />
                          ) : (
                            <span className="text-xs text-gray-500">
                              {Array.isArray(field.aliases) && (field.aliases as unknown[]).length > 0
                                ? (field.aliases as unknown[]).join(", ")
                                : "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 align-middle whitespace-nowrap">
                          <div className="flex flex-nowrap items-center gap-2">
                            <label className="inline-flex items-center gap-1 text-[11px]">
                              <input
                                type="checkbox"
                                checked={!!draft.isRequired}
                                onChange={(e) => handleEditFieldChange(field.id, "isRequired", e.target.checked)}
                                className="rounded border-gray-300 accent-black focus:ring-gray-500"
                                disabled={!editing}
                              />
                              必填
                            </label>
                            <label className="inline-flex items-center gap-1 text-[11px]">
                              <input
                                type="checkbox"
                                checked={!!draft.defaultVisible}
                                onChange={(e) => handleEditFieldChange(field.id, "defaultVisible", e.target.checked)}
                                className="rounded border-gray-300 accent-black focus:ring-gray-500"
                                disabled={!editing}
                              />
                              主檔可見
                            </label>
                            <label className="inline-flex items-center gap-1 text-[11px]">
                              <input
                                type="checkbox"
                                checked={!!draft.isExportable}
                                onChange={(e) => handleEditFieldChange(field.id, "isExportable", e.target.checked)}
                                className="rounded border-gray-300 accent-black focus:ring-gray-500"
                                disabled={!editing}
                              />
                              匯出
                            </label>
                          </div>
                        </td>
                        <td className="px-2 py-2 pr-3 align-middle text-right">
                          <div className="inline-flex items-center gap-0.5">
                            {editing ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  disabled={!dirty}
                                  onClick={() => void saveOne(field)}
                                  title="儲存本列"
                                >
                                  <Check className="w-4 h-4 text-green-600" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    cancelOne(field);
                                    setEditingRowId(null);
                                  }}
                                  title="取消編輯"
                                >
                                  <X className="w-4 h-4 text-gray-500" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => setEditingRowId(field.id)}
                                title="編輯欄位"
                              >
                                <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                              </Button>
                            )}
                            {!field.isSystem ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                onClick={() => void deleteOne(field)}
                                title="刪除欄位"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </div>
      </div>
    </div>
  );
};

