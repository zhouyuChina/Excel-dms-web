import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mergeDuplicatesJob } from '@/lib/dmsApi';
import { toast } from 'sonner';

interface MergeDuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMerged: () => void;
}

export const MergeDuplicatesModal: React.FC<MergeDuplicatesModalProps> = ({
  isOpen,
  onClose,
  onMerged,
}) => {
  const [keepStrategy, setKeepStrategy] = useState<'keep-latest-updated' | 'keep-oldest-created' | 'keep-most-complete'>('keep-latest-updated');
  const [fieldStrategy, setFieldStrategy] = useState<'merge-fill-empty' | 'merge-latest-wins'>('merge-fill-empty');
  const [loading, setLoading] = useState(false);

  const handleMerge = async () => {
    setLoading(true);
    try {
      const result = await mergeDuplicatesJob({
        keepStrategy,
        fieldStrategy,
      });
      toast.success(
        `重複合併完成：共找到 ${result.duplicateGroupsFound} 組，已處理 ${result.mergedGroups} 組，移除 ${result.deletedRows} 筆重複資料`
      );
      onMerged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '合併失敗');
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">合併重複資料</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              系統會依「國家 + 電話」找出重複客戶，並依你選的規則保留一筆主資料
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-6">
          {/* 重複判定（第一版固定） */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              重複判定鍵
            </h3>
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300">
              國家（country）+ 電話（phoneNormalized）
            </div>
          </div>

          {/* 保留主資料策略 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              保留主資料策略
            </h3>
            <Select value={keepStrategy} onValueChange={(v) => setKeepStrategy(v as any)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[2147483647]">
                <SelectItem value="keep-latest-updated">保留最近更新的一筆（建議）</SelectItem>
                <SelectItem value="keep-oldest-created">保留最早建立的一筆</SelectItem>
                <SelectItem value="keep-most-complete">保留欄位最完整的一筆</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 欄位合併策略 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">欄位合併策略</h3>
            <Select value={fieldStrategy} onValueChange={(v) => setFieldStrategy(v as any)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[2147483647]">
                <SelectItem value="merge-fill-empty">只填補主資料空白欄位（較安全）</SelectItem>
                <SelectItem value="merge-latest-wins">用最新資料覆蓋（較積極）</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={() => void handleMerge()} className="bg-gray-900 hover:bg-gray-800 text-white" disabled={loading}>
            {loading ? '合併中…' : '開始合併'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
