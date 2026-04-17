import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { addRemarksJob, type CustomerFilterSnapshot } from '@/lib/dmsApi';

interface AddRemarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCuids: string[];
  filteredCount: number | null;
  filterSnapshot: CustomerFilterSnapshot;
  onAdded: () => void;
}

export const AddRemarksModal: React.FC<AddRemarksModalProps> = ({
  isOpen,
  onClose,
  selectedCuids,
  filteredCount,
  filterSnapshot,
  onAdded,
}) => {
  const [targetData, setTargetData] = useState('filtered');
  const [fieldName, setFieldName] = useState('備註');
  const [remarkContent, setRemarkContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!fieldName.trim()) {
      toast.error('請輸入欄位名稱');
      return;
    }
    if (targetData === 'selected' && selectedCuids.length === 0) {
      toast.error('目前沒有勾選資料');
      return;
    }
    setLoading(true);
    try {
      const result = await addRemarksJob({
        target: targetData as "selected" | "filtered" | "all",
        cuids: targetData === "selected" ? selectedCuids : undefined,
        filterSnapshot: targetData === "all" ? undefined : filterSnapshot,
        fieldName: fieldName.trim(),
        remarkContent: remarkContent.trim(),
      });
      toast.success(`已更新 ${result.updated} 筆`);
      onAdded();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '添加備註失敗');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2147483647]">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">添加備註欄位</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              為篩選出的資料添加備註
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* 目標資料 */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
              目標資料
            </label>
            <Select value={targetData} onValueChange={setTargetData}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="filtered">
                  篩選出的資料（{filteredCount === null ? "筆數未即時計算" : `${filteredCount} 筆`}）
                </SelectItem>
                <SelectItem value="all">所有資料</SelectItem>
                <SelectItem value="selected">選中的資料 ({selectedCuids.length}筆)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 欄位名稱 */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
              欄位名稱
            </label>
            <Input
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              className="w-full"
              placeholder="備註"
            />
          </div>

          {/* 備註內容 */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
              備註內容
            </label>
            <textarea
              value={remarkContent}
              onChange={(e) => setRemarkContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none"
              rows={3}
              placeholder="請輸入備註內容 (留空將自動填入時間戳記)"
            />
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={() => void handleAdd()} className="bg-gray-900 hover:bg-gray-800 text-white" disabled={loading}>
            {loading ? '處理中…' : '確定添加'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
