import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MergeDuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MergeDuplicatesModal: React.FC<MergeDuplicatesModalProps> = ({ isOpen, onClose }) => {
  const [selectedFields, setSelectedFields] = useState<string[]>(['電話號碼', '姓名']);
  const [mergeStrategy, setMergeStrategy] = useState('keep_first');
  const [ignoreCase, setIgnoreCase] = useState(true);
  const [ignoreSpaces, setIgnoreSpaces] = useState(true);

  const comparisonFields = [
    { id: 'CUID', label: 'CUID' },
    { id: '國家', label: '國家' },
    { id: '提供者', label: '提供者' },
    { id: '電話號碼', label: '電話號碼' },
    { id: '姓名', label: '姓名' },
    { id: '電子郵件', label: '電子郵件' },
    { id: '部門', label: '部門' },
    { id: '職位', label: '職位' },
  ];

  const strategies = [
    { id: 'keep_first', label: '保留第一筆' },
    { id: 'keep_last', label: '保留最後一筆' },
    { id: 'keep_newest', label: '保留最新記錄' },
    { id: 'keep_oldest', label: '保留最早記錄' },
  ];

  const toggleField = (fieldId: string) => {
    setSelectedFields(prev => 
      prev.includes(fieldId) 
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const handleMerge = () => {
    // 模拟合并操作
    console.log('合併重複資料:', {
      selectedFields,
      mergeStrategy,
      ignoreCase,
      ignoreSpaces
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">合併重複資料</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              設定比較欄位和合併策略
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-6">
          {/* 比较字段 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              比較欄位 (多選)
            </h3>
            <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-3 space-y-2">
              {comparisonFields.map((field) => (
                <div key={field.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={field.id}
                    checked={selectedFields.includes(field.id)}
                    onChange={() => toggleField(field.id)}
                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                  />
                  <label htmlFor={field.id} className="text-sm text-gray-700 dark:text-gray-300">
                    {field.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* 合并策略 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              合併策略
            </h3>
            <Select value={mergeStrategy} onValueChange={setMergeStrategy}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {strategies.map((strategy) => (
                  <SelectItem key={strategy.id} value={strategy.id}>
                    {strategy.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 额外设置 */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="ignoreCase"
                checked={ignoreCase}
                onChange={(e) => setIgnoreCase(e.target.checked)}
                className="rounded border-gray-300 text-gray-900 focus:ring-gray-500"
              />
              <label htmlFor="ignoreCase" className="text-sm text-gray-700 dark:text-gray-300">
                忽略大小寫
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="ignoreSpaces"
                checked={ignoreSpaces}
                onChange={(e) => setIgnoreSpaces(e.target.checked)}
                className="rounded border-gray-300 text-gray-900 focus:ring-gray-500"
              />
              <label htmlFor="ignoreSpaces" className="text-sm text-gray-700 dark:text-gray-300">
                忽略前後空格
              </label>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleMerge} className="bg-gray-900 hover:bg-gray-800 text-white">
            開始合併
          </Button>
        </div>
      </div>
    </div>
  );
};
