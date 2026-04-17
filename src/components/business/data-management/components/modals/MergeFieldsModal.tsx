import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchFieldDefinitions,
  fetchMergeFieldsJob,
  formatApiThrownError,
  mergeFieldsJob,
  previewMergeFieldsJob,
} from '@/lib/dmsApi';
import { addRecentMergeFieldJobId, publishTaskCreated } from '@/lib/jobCenter';
import { toast } from 'sonner';

interface MergeFieldsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMerged: () => void;
}

export const MergeFieldsModal: React.FC<MergeFieldsModalProps> = ({ isOpen, onClose, onMerged }) => {
  /** 需與後端 `MERGE_FIELDS_HIGH_RISK_THRESHOLD` 預設（3000）一致；預覽 API 會帶 `riskThresholds`。 */
  const DEFAULT_HIGH_RISK_THRESHOLD = 3000;
  type WizardStep = 1 | 2 | 3 | 4 | 5;
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [primarySourceField, setPrimarySourceField] = useState<string>('');
  const [extraSourceFields, setExtraSourceFields] = useState<string[]>([]);
  const [targetFieldName, setTargetFieldName] = useState('');
  const [targetMode, setTargetMode] = useState<'existing' | 'new'>('existing');
  const [targetFieldKey, setTargetFieldKey] = useState<string>('');
  const [mergeStrategy, setMergeStrategy] = useState<'prioritize_non_empty' | 'keep_first' | 'keep_last' | 'concatenate'>('prioritize_non_empty');
  const [sourceFieldHandling, setSourceFieldHandling] = useState<'hide_field' | 'keep_field' | 'delete_field'>('keep_field');
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [mergeJobId, setMergeJobId] = useState<string | null>(null);
  const [mergeProgress, setMergeProgress] = useState<{ processedRows: number; totalRows: number; message?: string } | null>(null);
  const [preview, setPreview] = useState<null | {
    totalRows: number;
    rowsWithAnySourceValue: number;
    rowsWillWriteTarget: number;
    rowsTargetChanged: number;
    targetKey: string;
    targetExists: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    warnings: string[];
    riskThresholds?: { medium: number; high: number };
  }>(null);
  const [availableFields, setAvailableFields] = useState<Array<{ id: string; label: string; status: 'available' | 'disabled' }>>([]);
  const [submitConfirmed, setSubmitConfirmed] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    void (async () => {
      try {
        const { items } = await fetchFieldDefinitions();
        const list = items
          .filter((f) => !f.isSystem)
          .map((f) => ({ id: f.key, label: f.name, status: 'available' as const }));
        setAvailableFields(list);
        const first = list[0]?.id || '';
        const second = list[1]?.id || '';
        setPrimarySourceField(first);
        setExtraSourceFields(second ? [second] : []);
        setTargetFieldKey(first);
        const firstLabel = list.find((x) => x.id === first);
        setTargetFieldName(firstLabel?.label || '');
        setPreview(null);
        setWizardStep(1);
        setSubmitConfirmed(false);
      } catch {
        toast.error('無法載入欄位清單');
      }
    })();
  }, [isOpen]);

  const toggleExtraField = (fieldId: string) => {
    if (fieldId === primarySourceField) return;
    if (extraSourceFields.includes(fieldId)) {
      setExtraSourceFields((prev) => prev.filter((id) => id !== fieldId));
    } else {
      setExtraSourceFields((prev) => [...prev, fieldId]);
    }
    setPreview(null);
    setSubmitConfirmed(false);
  };

  const selectedFields = useMemo(
    () => [primarySourceField, ...extraSourceFields.filter((x) => x !== primarySourceField)].filter(Boolean),
    [primarySourceField, extraSourceFields]
  );

  useEffect(() => {
    if (!primarySourceField) return;
    if (!selectedFields.includes(targetFieldKey)) {
      setTargetFieldKey(primarySourceField);
    }
  }, [selectedFields, primarySourceField, targetFieldKey]);

  useEffect(() => {
    if (!mergeJobId) return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const job = await fetchMergeFieldsJob(mergeJobId);
          setMergeProgress({
            processedRows: job.processedRows,
            totalRows: job.totalRows,
            message: job.message,
          });
          if (job.status === 'completed') {
            window.clearInterval(timer);
            toast.success(`欄位合併完成，更新 ${job.changedRows} 筆`);
            setLoading(false);
            setMergeJobId(null);
            onMerged();
            onClose();
          } else if (job.status === 'failed') {
            window.clearInterval(timer);
            toast.error(job.error || '欄位合併失敗');
            setLoading(false);
            setMergeJobId(null);
          }
        } catch (e) {
          window.clearInterval(timer);
          setLoading(false);
          setMergeJobId(null);
          toast.error(formatApiThrownError(e, '讀取合併進度失敗'));
        }
      })();
    }, 1200);
    return () => window.clearInterval(timer);
  }, [mergeJobId, onClose, onMerged]);

  const getFieldStatusColor = (status: string) => {
    switch (status) {
      case 'selected':
        return 'bg-blue-500';
      case 'available':
        return 'bg-green-500';
      case 'disabled':
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  };

  const handlePreview = async () => {
    if (selectedFields.length < 2) {
      toast.error('至少選擇 2 個來源欄位');
      return;
    }
    const targetNameFinal =
      targetMode === 'existing'
        ? availableFields.find((x) => x.id === targetFieldKey)?.label || ''
        : targetFieldName.trim();
    if (!targetNameFinal) {
      toast.error('請輸入目標欄位名稱');
      return;
    }
    setPreviewLoading(true);
    try {
      const result = await previewMergeFieldsJob({
        sourceKeys: selectedFields,
        targetName: targetNameFinal,
        mergeStrategy,
        sourceFieldHandling,
      });
      setPreview(result);
      setSubmitConfirmed(false);
      toast.success('已完成影響預覽');
    } catch (e) {
      toast.error(formatApiThrownError(e, '預覽失敗'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (selectedFields.length < 2) {
      toast.error('至少選擇 2 個來源欄位');
      return;
    }
    const targetNameFinal =
      targetMode === 'existing'
        ? availableFields.find((x) => x.id === targetFieldKey)?.label || ''
        : targetFieldName.trim();
    if (!targetNameFinal) {
      toast.error('請輸入目標欄位名稱');
      return;
    }
    if (!preview) {
      toast.error('請先按「預覽影響筆數」');
      return;
    }
    if (!submitConfirmed) {
      toast.error('請先勾選「我已確認本次合併設定」');
      return;
    }
    const highRiskThreshold = Number(preview.riskThresholds?.high ?? DEFAULT_HIGH_RISK_THRESHOLD);
    if (preview.rowsTargetChanged >= highRiskThreshold) {
      const ok = window.confirm(
        `這次預計改變 ${preview.rowsTargetChanged} 筆資料（高風險）。\n\n請再次確認要送出合併任務。`
      );
      if (!ok) return;
    }
    setLoading(true);
    try {
      const result = await mergeFieldsJob({
        sourceKeys: selectedFields,
        targetName: targetNameFinal,
        mergeStrategy,
        sourceFieldHandling,
      });
      addRecentMergeFieldJobId(result.jobId);
      publishTaskCreated({
        id: result.jobId,
        source: 'merge-fields',
        status: 'queued',
        title: `合併欄位：${targetNameFinal}`,
        subtitle: '已建立欄位合併任務',
        createdAt: new Date().toISOString(),
        processedRows: 0,
        totalRows: preview?.totalRows ?? 0,
      });
      setMergeJobId(result.jobId);
      setMergeProgress({ processedRows: 0, totalRows: 0, message: '已送出合併工作，等待處理' });
      toast.message('已送出欄位合併工作，請稍候');
    } catch (e) {
      toast.error(formatApiThrownError(e, '合併欄位失敗'));
      setLoading(false);
    }
  };

  const targetNameFinal =
    targetMode === 'existing'
      ? availableFields.find((x) => x.id === targetFieldKey)?.label || ''
      : targetFieldName.trim();

  const canStep2 = !!primarySourceField;
  const canStep3 = selectedFields.length >= 2;
  const canStep4 = canStep3 && !!targetNameFinal;
  const selectedFieldLabels = useMemo(
    () => selectedFields.map((x) => availableFields.find((f) => f.id === x)?.label || x),
    [selectedFields, availableFields]
  );
  const riskTone =
    preview?.riskLevel === 'high'
      ? 'bg-red-50 border-red-200 text-red-700'
      : preview?.riskLevel === 'medium'
      ? 'bg-amber-50 border-amber-200 text-amber-700'
      : 'bg-green-50 border-green-200 text-green-700';

  const goNextStep = () => {
    if (wizardStep === 1 && !canStep2) {
      toast.error('請先選擇第一個主欄位');
      return;
    }
    if (wizardStep === 2 && !canStep3) {
      toast.error('請至少再選 1 個要合併進來的欄位');
      return;
    }
    if (wizardStep === 3 && !canStep4) {
      toast.error('請先設定目標欄位');
      return;
    }
    if (wizardStep < 5) setWizardStep((s) => (s + 1) as WizardStep);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2147483647]">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">合併欄位</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              選擇要合併的欄位並設定合併策略
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-xs text-gray-600">
            <div className="font-medium">步驟 {wizardStep} / 5</div>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((step) => (
                <span
                  key={step}
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${
                    wizardStep === step
                      ? 'border-black bg-black text-white'
                      : wizardStep > step
                      ? 'border-green-600 bg-green-600 text-white'
                      : 'border-gray-300 text-gray-500'
                  }`}
                >
                  {wizardStep > step ? <CheckCircle2 className="h-3.5 w-3.5" /> : step}
                </span>
              ))}
            </div>
          </div>

          {wizardStep === 1 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Step 1：先選第一個主欄位
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              這個欄位會當作主要參考欄位，下一步再選要合併進來的欄位。
            </p>
            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-2">
                {availableFields.map((field) => {
                  return (
                  <button
                    key={field.id}
                    onClick={() => {
                      setPrimarySourceField(field.id);
                      setExtraSourceFields((prev) => prev.filter((x) => x !== field.id));
                      setTargetFieldKey(field.id);
                      setPreview(null);
                      setSubmitConfirmed(false);
                    }}
                    disabled={field.status === 'disabled'}
                    className={`flex items-center space-x-2 p-2 rounded text-left transition-colors ${
                      primarySourceField === field.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    } ${field.status === 'disabled' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${getFieldStatusColor(field.status)}`}></div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{field.label}</span>
                    {primarySourceField === field.id && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-blue-600 text-white">主欄位</span>
                    )}
                  </button>
                )})}
              </div>
            </div>
          </div>
          )}

          {wizardStep === 2 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Step 2：選擇要合併進來的欄位（可單選或多選）
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              已選主欄位：{availableFields.find((x) => x.id === primarySourceField)?.label || primarySourceField}
            </p>
            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-2">
                {availableFields.map((field) => {
                  const selected = extraSourceFields.includes(field.id);
                  const disabled = field.id === primarySourceField;
                  return (
                    <button
                      key={field.id}
                      onClick={() => toggleExtraField(field.id)}
                      disabled={disabled || field.status === 'disabled'}
                      className={`flex items-center space-x-2 p-2 rounded text-left transition-colors ${
                        selected
                          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      } ${(disabled || field.status === 'disabled') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className={`w-2 h-2 rounded-full ${getFieldStatusColor(field.status)}`}></div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{field.label}</span>
                      {disabled && (
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-gray-500 text-white">主欄位</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              目前共選了 {selectedFields.length} 個來源欄位（至少 2 個）。
            </p>
          </div>
          )}

          {wizardStep === 3 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Step 3：設定目標欄位
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={targetMode === 'existing'}
                  onChange={() => {
                    setTargetMode('existing');
                    setPreview(null);
                  }}
                />
                併入既有欄位（推薦）
              </label>
              {targetMode === 'existing' && (
                <select
                  className="w-full border rounded px-2 py-2 text-sm bg-white dark:bg-gray-800"
                  value={targetFieldKey}
                  onChange={(e) => {
                    setTargetFieldKey(e.target.value);
                    setPreview(null);
                  }}
                >
                  {selectedFields.map((key) => {
                    const f = availableFields.find((x) => x.id === key);
                    return (
                      <option key={key} value={key}>
                        {f?.label || key}
                      </option>
                    );
                  })}
                </select>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={targetMode === 'new'}
                  onChange={() => {
                    setTargetMode('new');
                    setPreview(null);
                  }}
                />
                建立新欄位再併入
              </label>
              {targetMode === 'new' && (
                <Input
                  value={targetFieldName}
                  onChange={(e) => {
                    setTargetFieldName(e.target.value);
                    setPreview(null);
                  }}
                  placeholder="輸入新欄位名稱"
                  className="w-full"
                />
              )}
            </div>
          </div>
          )}

          {wizardStep === 4 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Step 4：預覽與策略設定
            </h3>
            <div className="space-y-2">
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="mergeStrategy"
                  value="prioritize_non_empty"
                  checked={mergeStrategy === 'prioritize_non_empty'}
                  onChange={(e) => {
                    setMergeStrategy(e.target.value as 'prioritize_non_empty' | 'keep_first' | 'keep_last' | 'concatenate');
                    setPreview(null);
                  }}
                  className="mt-0.5"
                />
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">優先非空值</span> - 保留第一個非空的值
                </div>
              </label>
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="mergeStrategy"
                  value="keep_first"
                  checked={mergeStrategy === 'keep_first'}
                  onChange={(e) => {
                    setMergeStrategy(e.target.value as 'prioritize_non_empty' | 'keep_first' | 'keep_last' | 'concatenate');
                    setPreview(null);
                  }}
                  className="mt-0.5"
                />
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">保留第一個</span> - 始終使用第一個欄位的值
                </div>
              </label>
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="mergeStrategy"
                  value="keep_last"
                  checked={mergeStrategy === 'keep_last'}
                  onChange={(e) => {
                    setMergeStrategy(e.target.value as 'prioritize_non_empty' | 'keep_first' | 'keep_last' | 'concatenate');
                    setPreview(null);
                  }}
                  className="mt-0.5"
                />
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">保留最後一個</span> - 始終使用最後一個欄位的值
                </div>
              </label>
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="mergeStrategy"
                  value="concatenate"
                  checked={mergeStrategy === 'concatenate'}
                  onChange={(e) => {
                    setMergeStrategy(e.target.value as 'prioritize_non_empty' | 'keep_first' | 'keep_last' | 'concatenate');
                    setPreview(null);
                  }}
                  className="mt-0.5"
                />
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">合併連接</span> - 用「|」連接所有非空值
                </div>
              </label>
            </div>
          </div>
          )}

          {wizardStep === 4 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              原來源欄位處理方式
            </h3>
            <div className="space-y-2">
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="sourceFieldHandling"
                  value="hide_field"
                  checked={sourceFieldHandling === 'hide_field'}
                  onChange={(e) => setSourceFieldHandling(e.target.value as 'hide_field' | 'keep_field' | 'delete_field')}
                  className="mt-0.5"
                />
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">隱藏欄位</span> - 保留資料但從顯示中移除 (推薦)
                </div>
              </label>
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="sourceFieldHandling"
                  value="keep_field"
                  checked={sourceFieldHandling === 'keep_field'}
                  onChange={(e) => setSourceFieldHandling(e.target.value as 'hide_field' | 'keep_field' | 'delete_field')}
                  className="mt-0.5"
                />
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">保留欄位</span> - 繼續顯示原來源欄位
                </div>
              </label>
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="sourceFieldHandling"
                  value="delete_field"
                  checked={sourceFieldHandling === 'delete_field'}
                  onChange={(e) => setSourceFieldHandling(e.target.value as 'hide_field' | 'keep_field' | 'delete_field')}
                  className="mt-0.5"
                />
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">刪除欄位</span> - 永久移除原來源欄位和資料
                </div>
              </label>
            </div>
          </div>
          )}

          {wizardStep === 4 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
            {preview ? (
              <div className="space-y-1">
                <div>總資料列：{preview.totalRows}</div>
                <div>來源欄位有值：{preview.rowsWithAnySourceValue}</div>
                <div>目標欄位將寫入非空值：{preview.rowsWillWriteTarget}</div>
                <div>目標欄位值會改變：{preview.rowsTargetChanged}</div>
                <div>目標欄位：{preview.targetExists ? '既有欄位' : '將建立新欄位'}（{preview.targetKey}）</div>
                <div className={`inline-flex mt-1 rounded border px-2 py-0.5 text-xs ${riskTone}`}>
                  風險等級：{preview.riskLevel === 'high' ? '高' : preview.riskLevel === 'medium' ? '中' : '低'}
                </div>
                {preview.warnings?.length > 0 && (
                  <ul className="mt-2 list-disc pl-4 text-xs text-amber-800">
                    {preview.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div>尚未預覽，請先點「預覽影響筆數」。</div>
            )}
          </div>
          )}

          {wizardStep === 5 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Step 5：確認送出</h3>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm space-y-1">
                <div>來源欄位：{selectedFieldLabels.join('、')}</div>
                <div>目標欄位：{targetNameFinal}</div>
                <div>合併策略：{mergeStrategy}</div>
                <div>來源欄位處理：{sourceFieldHandling}</div>
                <div>預估變更：{preview?.rowsTargetChanged ?? 0} 筆</div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={submitConfirmed}
                  onChange={(e) => setSubmitConfirmed(e.target.checked)}
                />
                我已確認本次合併設定，送出後將以背景任務執行。
              </label>
            </div>
          )}

          {loading && (
            <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <div className="text-sm mb-2 text-gray-700 dark:text-gray-300">
                {mergeProgress?.message || '欄位合併進行中…'}
              </div>
              <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{
                    width: `${mergeProgress?.totalRows ? Math.min(100, Math.floor((mergeProgress.processedRows / mergeProgress.totalRows) * 100)) : 15}%`,
                  }}
                />
              </div>
              <div className="text-xs mt-1 text-gray-500">
                {mergeProgress?.processedRows ?? 0}/{mergeProgress?.totalRows ?? 0}
              </div>
            </div>
          )}

          {(wizardStep === 4 || wizardStep === 5) && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  注意事項
                </h4>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  <li>• 合併操作會將選定的來源欄位資料整合到目標欄位</li>
                  <li>• 隱藏的欄位可在欄位管理中重新顯示</li>
                  <li>• 此操作會影響所有現有資料行</li>
                </ul>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">會影響全部資料列</div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose} disabled={loading || previewLoading}>
              取消
            </Button>
            {wizardStep > 1 && (
              <Button
                variant="outline"
                onClick={() =>
                  setWizardStep((s) => {
                    if (s <= 1) return 1;
                    return (s - 1) as WizardStep;
                  })
                }
                disabled={loading || previewLoading}
              >
                上一步
              </Button>
            )}
            {wizardStep === 4 && (
              <Button variant="outline" onClick={() => void handlePreview()} disabled={loading || previewLoading}>
                {previewLoading ? '預覽中…' : '重新預覽'}
              </Button>
            )}
            {wizardStep < 5 ? (
              <Button onClick={goNextStep} className="bg-gray-900 hover:bg-gray-800 text-white" disabled={loading || previewLoading || (wizardStep === 4 && !preview)}>
                下一步
              </Button>
            ) : (
              <Button onClick={() => void handleSubmit()} className="bg-gray-900 hover:bg-gray-800 text-white" disabled={loading || previewLoading || !submitConfirmed}>
                {loading ? '送出中…' : '確認送出任務'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
