import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CleanInvalidModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CleanInvalidModal: React.FC<CleanInvalidModalProps> = ({ isOpen, onClose }) => {
  const handleClean = () => {
    // 模拟清理操作
    console.log('清理無效資料');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                將檢查並清理以下類型的無效資料:
              </span>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">•</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">英文姓名:</span> 包含非英文字符
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">•</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">中文姓名:</span> 包含非中文字符
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">•</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">電子郵件:</span> 格式不正確
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">•</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">電話號碼:</span> 包含非數字字符
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">•</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">日期:</span> 格式不正確
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">•</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">數字:</span> 非數值資料
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end space-x-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleClean} className="bg-gray-900 hover:bg-gray-800 text-white">
            開始清理
          </Button>
        </div>
      </div>
    </div>
  );
};
