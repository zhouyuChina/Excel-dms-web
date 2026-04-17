import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// 分组数据类型
interface FieldGroup {
  id: string;
  name: string;
  color: string;
  fieldCount: number;
  isSystem: boolean;
}

// 颜色选项
const colorOptions = [
  { value: 'purple', label: '紫色', color: 'bg-purple-500' },
  { value: 'blue', label: '藍色', color: 'bg-blue-500' },
  { value: 'green', label: '綠色', color: 'bg-green-500' },
  { value: 'orange', label: '橙色', color: 'bg-orange-500' },
  { value: 'red', label: '紅色', color: 'bg-red-500' },
  { value: 'cyan', label: '青色', color: 'bg-cyan-500' },
  { value: 'yellow', label: '黃色', color: 'bg-yellow-500' },
  { value: 'pink', label: '粉色', color: 'bg-pink-500' }
];

interface GroupManagementTabProps {
  groups: FieldGroup[];
  /** 初次載入時顯示骨架 */
  dataLoading?: boolean;
  onCreate: (data: { name: string; color: string }) => Promise<void>;
  onPatch: (id: string, data: { name: string; color: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const GroupManagementTab: React.FC<GroupManagementTabProps> = ({
  groups,
  dataLoading = false,
  onCreate,
  onPatch,
  onDelete,
}) => {
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('blue');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('blue');

  // 处理新增分组
  const handleAddGroup = async () => {
    if (newGroupName.trim()) {
      await onCreate({ name: newGroupName.trim(), color: `bg-${newGroupColor}-500` });
      setNewGroupName('');
      setNewGroupColor('blue');
    }
  };

  // 处理编辑分组
  const handleEditGroup = (group: FieldGroup) => {
    setEditingGroupId(group.id);
    setEditingName(group.name);
    const match = group.color.match(/^bg-(.+)-500$/);
    setEditingColor(match?.[1] || "blue");
  };

  const handleSaveEdit = async () => {
    if (!editingGroupId || !editingName.trim()) return;
    await onPatch(editingGroupId, {
      name: editingName.trim(),
      color: `bg-${editingColor}-500`,
    });
    setEditingGroupId(null);
  };

  const handleCancelEdit = () => {
    setEditingGroupId(null);
    setEditingName('');
    setEditingColor('blue');
  };

  // 处理删除分组
  const handleDeleteGroup = async (groupId: string) => {
    await onDelete(groupId);
  };

  // 获取颜色样式
  const getColorClass = (color: string) => {
    if (color.startsWith("bg-")) return color;
    const colorMap: Record<string, string> = {
      purple: 'bg-purple-500',
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      orange: 'bg-orange-500',
      red: 'bg-red-500',
      cyan: 'bg-cyan-500',
      yellow: 'bg-yellow-500',
      pink: 'bg-pink-500'
    };
    return colorMap[color] || 'bg-gray-500';
  };

  if (dataLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3" />
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-md animate-pulse max-w-lg" />
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-md bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const sortedGroups = [...groups].sort((a, b) => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
    return a.name.localeCompare(b.name, "zh-Hant");
  });

  /** 列表可視高度：約表頭 + 4 列分組，其餘捲動（細捲軸） */
  const listScrollClass = cn(
    "min-h-0 overflow-y-auto overflow-x-auto overscroll-contain",
    "max-h-[min(14.5rem,50vh)]",
    "[scrollbar-width:thin]",
    "[scrollbar-color:rgb(209_213_219)_transparent] dark:[scrollbar-color:rgb(75_85_99)_transparent]",
    "[&::-webkit-scrollbar]:w-2",
    "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600",
    "[&::-webkit-scrollbar-track]:bg-transparent"
  );

  return (
    <div className="flex min-h-0 w-full flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950/30 shadow-sm">
      {/* 新增列：固定高度，不隨列表變長 */}
      <div className="shrink-0 px-3 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/40">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[140px] flex-1">
            <Input
              className="h-9"
              placeholder="新增分組名稱"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
          </div>
          <Select value={newGroupColor} onValueChange={setNewGroupColor}>
            <SelectTrigger className="h-9 w-[118px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {colorOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${option.color}`} />
                    <span>{option.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            onClick={handleAddGroup}
            disabled={!newGroupName.trim()}
            className="h-9 bg-gray-800 text-white hover:bg-gray-900 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            建立
          </Button>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 ml-auto">
            {groups.length} 個分組
          </span>
        </div>
      </div>

      {/* 表格式列表：可視約 4 筆分組，超出則捲動 */}
      <div className={listScrollClass}>
        {sortedGroups.length === 0 ? (
          <div className="py-10 px-4 text-center text-sm text-gray-500 dark:text-gray-400">
            尚無分組。
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="sticky top-0 z-[1] border-b border-gray-200 dark:border-gray-700 bg-white/95 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500 shadow-[0_1px_0_0_rgb(229_231_235)] backdrop-blur-sm dark:bg-gray-950/95 dark:text-gray-400 dark:shadow-[0_1px_0_0_rgb(31_41_55)]">
                <th className="w-10 px-2 py-2 pl-3" aria-label="顏色" />
                <th className="px-2 py-2 min-w-[200px]">分組</th>
                <th className="w-24 px-2 py-2 text-right">欄位數</th>
                <th className="w-24 px-2 py-2 pr-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sortedGroups.map((group) => {
                const isEditing = editingGroupId === group.id;
                return (
                  <tr key={group.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/40 transition-colors">
                    <td className="px-2 py-2 pl-3 align-middle">
                      <span className={cn("inline-block w-3 h-3 rounded-full", getColorClass(group.color))} />
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <Input
                            className="h-9 w-56"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                          />
                        ) : (
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {group.name}
                            {group.isSystem ? (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded border border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-200">
                                系統
                              </span>
                            ) : null}
                          </div>
                        )}

                        {isEditing ? (
                          <Select value={editingColor} onValueChange={setEditingColor}>
                            <SelectTrigger className="h-9 w-[118px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {colorOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${option.color}`} />
                                    <span>{option.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2 py-2 align-middle text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {group.fieldCount}
                    </td>
                    <td className="px-2 py-2 pr-3 align-middle text-right">
                      {isEditing ? (
                        <div className="inline-flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleSaveEdit()}
                            disabled={!editingName.trim()}
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelEdit}
                            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditGroup(group)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                          </Button>
                          {!group.isSystem ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleDeleteGroup(group.id)}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          ) : null}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};