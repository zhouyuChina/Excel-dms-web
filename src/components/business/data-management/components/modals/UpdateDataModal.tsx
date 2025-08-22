import React, { useState } from 'react';
import { X, Upload, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UpdateDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateDataModal: React.FC<UpdateDataModalProps> = ({ isOpen, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">智能資料更新</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              上傳包含有效 CUID 的資料檔案，僅更新系統中已存在的記錄，不會新增新資料
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-6">
          {/* 上传区域 */}
          <div className="text-center">
            {/* 上传图标 */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">上傳更新檔案</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              僅支援更新現有資料，每筆資料必須包含有效的CUID才能進行匹配更新
            </p>

            {/* 拖拽上传区域 */}
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                點擊選擇檔案或拖拽到此處
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                支援 .csv, .xlsx, .xls 格式
              </p>
              
              <input
                type="file"
                id="file-upload"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* 已选择文件显示 */}
            {selectedFile && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-300">
                  已選擇檔案: {selectedFile.name}
                </p>
              </div>
            )}
          </div>

          {/* 重要说明 */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  更新資料重要說明
                </h4>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  <li className="flex items-start">
                    <span className="font-semibold mr-1">• 必須包含 CUID:</span>
                    每筆資料都必須有有效的CUID 欄位
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-1">• 僅更新現有資料:</span>
                    只會更新系統中已存在的記錄，不會新增新記錄
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-1">• 無需填寫國家/提供者:</span>
                    更新操作不需要重新填寫這些系統欄位
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-1">• 自動跳過無效資料:</span>
                    缺少CUID或不存在的記錄將被自動跳過
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            步驟 1/4
          </div>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
        </div>
      </div>
    </div>
  );
};
