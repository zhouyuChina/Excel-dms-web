import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AddRemarksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddRemarksModal: React.FC<AddRemarksModalProps> = ({ isOpen, onClose }) => {
  const [targetData, setTargetData] = useState('filtered');
  const [fieldName, setFieldName] = useState('備註');
  const [remarkContent, setRemarkContent] = useState('');

  const handleAdd = () => {
    // 模拟添加备注操作
    console.log('添加備註欄位:', {
      targetData,
      fieldName,
      remarkContent
    });
    onClose();
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
                <SelectItem value="filtered">篩選出的資料 (6筆)</SelectItem>
                <SelectItem value="all">所有資料</SelectItem>
                <SelectItem value="selected">選中的資料</SelectItem>
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
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleAdd} className="bg-gray-900 hover:bg-gray-800 text-white">
            確定添加
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
