import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const [recipient, setRecipient] = useState('');
  const [remarks, setRemarks] = useState('');

  const handleExport = () => {
    // 模拟导出操作
    console.log('匯出資料:', {
      recipient,
      remarks
    });
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">匯出資料</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* 匯出信息 */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            將匯出 6 筆資料
          </div>

          {/* 接收者 */}
          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              接收者 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="mt-1"
              placeholder="請輸入接收者"
            />
          </div>

          {/* 備註 */}
          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">備註</Label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none"
              rows={3}
              placeholder="選填:匯出說明或備註"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleExport} className="bg-gray-900 hover:bg-gray-800 text-white">
            確定匯出
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
