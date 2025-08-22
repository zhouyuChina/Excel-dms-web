import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface MergeFieldsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MergeFieldsModal: React.FC<MergeFieldsModalProps> = ({ isOpen, onClose }) => {
  const [selectedFields, setSelectedFields] = useState<string[]>(['姓名', '英文姓名', '年齡', '出生日期']);
  const [targetFieldName, setTargetFieldName] = useState('');
  const [mergeStrategy, setMergeStrategy] = useState('prioritize_non_empty');
  const [sourceFieldHandling, setSourceFieldHandling] = useState('hide_field');

  const availableFields = [
    { id: '姓名', label: '姓名', status: 'selected' },
    { id: '英文姓名', label: '英文姓名', status: 'selected' },
    { id: '年齡', label: '年齡', status: 'selected' },
    { id: '出生日期', label: '出生日期', status: 'selected' },
    { id: '職位', label: '職位', status: 'available' },
    { id: '薪資', label: '薪資', status: 'available' },
    { id: '電子郵件', label: '電子郵件', status: 'available' },
    { id: '部門', label: '部門', status: 'available' },
    { id: '匯入紀錄', label: '匯入紀錄', status: 'disabled' },
    { id: '匯出紀錄', label: '匯出紀錄', status: 'disabled' },
  ];

  const toggleField = (fieldId: string) => {
    if (selectedFields.includes(fieldId)) {
      if (selectedFields.length > 2) {
        setSelectedFields(prev => prev.filter(id => id !== fieldId));
      }
    } else {
      setSelectedFields(prev => [...prev, fieldId]);
    }
  };

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

  const handleNext = () => {
    // 模拟下一步操作
    console.log('合併欄位配置:', {
      selectedFields,
      targetFieldName,
      mergeStrategy,
      sourceFieldHandling
    });
    // 这里应该进入下一步预览
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
          {/* 選擇要合併的來源欄位 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              選擇要合併的來源欄位
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              (至少選擇2個)
            </p>
            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-2">
                {availableFields.map((field) => (
                  <button
                    key={field.id}
                    onClick={() => toggleField(field.id)}
                    disabled={field.status === 'disabled'}
                    className={`flex items-center space-x-2 p-2 rounded text-left transition-colors ${
                      selectedFields.includes(field.id)
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    } ${field.status === 'disabled' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${getFieldStatusColor(field.status)}`}></div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{field.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 目標欄位名稱 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              目標欄位名稱
            </h3>
            <Input
              value={targetFieldName}
              onChange={(e) => setTargetFieldName(e.target.value)}
              placeholder="輸入合併後的欄位名稱,例如:姓名"
              className="w-full"
            />
          </div>

          {/* 合併策略 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              合併策略
            </h3>
            <div className="space-y-2">
              <label className="flex items-start space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="mergeStrategy"
                  value="prioritize_non_empty"
                  checked={mergeStrategy === 'prioritize_non_empty'}
                  onChange={(e) => setMergeStrategy(e.target.value)}
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
                  onChange={(e) => setMergeStrategy(e.target.value)}
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
                  onChange={(e) => setMergeStrategy(e.target.value)}
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
                  onChange={(e) => setMergeStrategy(e.target.value)}
                  className="mt-0.5"
                />
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">合併連接</span> - 用「|」連接所有非空值
                </div>
              </label>
            </div>
          </div>

          {/* 原來源欄位處理方式 */}
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
                  onChange={(e) => setSourceFieldHandling(e.target.value)}
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
                  onChange={(e) => setSourceFieldHandling(e.target.value)}
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
                  onChange={(e) => setSourceFieldHandling(e.target.value)}
                  className="mt-0.5"
                />
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">刪除欄位</span> - 永久移除原來源欄位和資料
                </div>
              </label>
            </div>
          </div>

          {/* 注意事項 */}
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
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            步驟 1/3
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleNext} className="bg-gray-900 hover:bg-gray-800 text-white">
              下一步: 預覽
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
