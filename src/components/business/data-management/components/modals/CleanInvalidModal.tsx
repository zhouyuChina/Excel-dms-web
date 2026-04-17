import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  cleanInvalidJob,
  formatApiThrownError,
  previewCleanInvalidJob,
  type CustomerFilterSnapshot,
} from '@/lib/dmsApi';
import { publishTaskCreated } from '@/lib/jobCenter';
import { toast } from 'sonner';

const REASON_LABELS: Record<string, string> = {
  phone_empty: '電話空白',
  email_invalid: 'Email 格式錯誤',
  phone_extra_1: '電話多 1 碼',
  phone_extra_2: '電話多 2 碼以上',
  phone_short_1: '電話少 1 碼',
  phone_short_2: '電話少 2 碼以上',
  country_phone_mismatch: '電話與國別不符',
};

interface CleanInvalidModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCuids: string[];
  filteredCount: number | null;
  filterSnapshot: CustomerFilterSnapshot;
  onCleaned: () => void;
  onOpenQuarantine?: () => void;
}

export const CleanInvalidModal: React.FC<CleanInvalidModalProps> = ({
  isOpen,
  onClose,
  selectedCuids,
  filteredCount,
  filterSnapshot,
  onCleaned,
}) => {
  const [target, setTarget] = useState<'selected' | 'filtered' | 'all'>('filtered');
  const [rules, setRules] = useState<Array<"phone_empty" | "email_invalid" | "phone_country_invalid">>([
    "phone_empty",
    "email_invalid",
    "phone_country_invalid",
  ]);
  const [preview, setPreview] = useState<null | {
    targetRows: number;
    invalidRows: number;
    byRule: Record<string, number>;
  }>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleRule = (rule: "phone_empty" | "email_invalid" | "phone_country_invalid") => {
    setRules((prev) => {
      const exists = prev.includes(rule);
      if (exists) return prev.filter((x) => x !== rule);
      return [...prev, rule];
    });
    setPreview(null);
  };

  const handlePreview = async () => {
    if (!rules.length) {
      toast.error("請至少選擇一個清理規則");
      return;
    }
    setPreviewLoading(true);
    try {
      const result = await previewCleanInvalidJob({
        target,
        cuids: target === 'selected' ? selectedCuids : undefined,
        filterSnapshot: target === 'all' ? undefined : filterSnapshot,
        rules,
      });
      setPreview({ targetRows: result.targetRows, invalidRows: result.invalidRows, byRule: result.byRule || {} });
    } catch (e) {
      toast.error(formatApiThrownError(e, '預覽失敗'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClean = async () => {
    if (!preview) {
      toast.error('請先預覽清理筆數');
      return;
    }
    if (preview.invalidRows <= 0) {
      toast.message('沒有可清理資料');
      return;
    }
    const ok = window.confirm(`將建立清理任務（預設隔離）處理 ${preview.invalidRows} 筆，確定繼續？`);
    if (!ok) return;
    setLoading(true);
    try {
      const result = await cleanInvalidJob({
        target,
        cuids: target === 'selected' ? selectedCuids : undefined,
        filterSnapshot: target === 'all' ? undefined : filterSnapshot,
        rules,
        mode: 'quarantine',
      });
      publishTaskCreated({
        id: result.jobId,
        source: 'clean-invalid',
        status: 'queued',
        title: '清理無效（隔離）',
        subtitle: target === 'selected' ? `已勾選 ${selectedCuids.length} 筆` : target === 'all' ? '全部資料' : '目前篩選',
        createdAt: new Date().toISOString(),
        processedRows: 0,
        totalRows: Math.max(1, preview.invalidRows),
      });
      toast.success('已建立清理任務，請到任務中心查看進度');
      onCleaned();
      onClose();
    } catch (e) {
      toast.error(formatApiThrownError(e, '清理失敗'));
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">清理無效資料</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              此功能將清理格式不正確的資料欄位
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* 警告和清理规则 */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                本版清理規則（P1-5 第一版）:
              </span>
            </div>
            
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={rules.includes("phone_empty")} onChange={() => toggleRule("phone_empty")} />
                <span><span className="font-medium">電話號碼空白</span>（phone/phoneNormalized）</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={rules.includes("email_invalid")} onChange={() => toggleRule("email_invalid")} />
                <span><span className="font-medium">Email 格式不正確</span></span>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={rules.includes("phone_country_invalid")}
                  onChange={() => toggleRule("phone_country_invalid")}
                />
                <span><span className="font-medium">電話與國別格式不符</span>（依國別規則）</span>
              </label>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">清理範圍</div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="target"
                checked={target === 'filtered'}
                onChange={() => {
                  setTarget('filtered');
                  setPreview(null);
                }}
              />
              目前篩選（{filteredCount === null ? "筆數未即時計算" : `${filteredCount} 筆`}）
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="target"
                checked={target === 'selected'}
                onChange={() => {
                  setTarget('selected');
                  setPreview(null);
                }}
              />
              已勾選（{selectedCuids.length} 筆）
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="target"
                checked={target === 'all'}
                onChange={() => {
                  setTarget('all');
                  setPreview(null);
                }}
              />
              全部資料
            </label>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
            {preview ? (
              <>
                <div>目標範圍筆數：{preview.targetRows}</div>
                <div>可清理筆數（聯集）：{preview.invalidRows}</div>
                <div className="mt-1 text-xs text-blue-700">
                  規則明細：
                  {Object.keys(preview.byRule || {}).length === 0
                    ? ' 無'
                    : ` ${Object.entries(preview.byRule)
                        .map(([key, count]) => `${REASON_LABELS[key] || key} ${count}`)
                        .join('、')}`}
                </div>
              </>
            ) : (
              <div>尚未預覽，請先點「預覽清理筆數」。</div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end space-x-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose} disabled={loading || previewLoading}>
            取消
          </Button>
          <Button variant="outline" onClick={() => void handlePreview()} disabled={loading || previewLoading}>
            {previewLoading ? '預覽中…' : '預覽清理筆數'}
          </Button>
          <Button onClick={() => void handleClean()} className="bg-gray-900 hover:bg-gray-800 text-white" disabled={loading || previewLoading}>
            送至隔離區
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
