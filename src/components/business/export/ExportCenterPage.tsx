import React, { useState } from 'react';
import { Settings, Download, Eye, Trash2, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ExportRecord {
  id: string;
  fileName: string;
  fileType: string;
  createdDate: string;
  createdTime: string;
  status: 'completed' | 'processing' | 'failed';
  totalRows: number;
  fileSize: string;
  creator: string;
  year: string;
  month: string;
  columns: string;
}

const mockExportRecords: ExportRecord[] = [
  {
    id: '1',
    fileName: '員工資料_2024-03-01.xlsx',
    fileType: 'Excel',
    createdDate: '2024-03-01',
    createdTime: '10:30',
    status: 'completed',
    totalRows: 125,
    fileSize: '4.2MB',
    creator: '人資部王某',
    year: '2024',
    month: '03',
    columns: '姓名, 年齡, 部位, +1'
  },
  {
    id: '2',
    fileName: '匯出進行中.csv',
    fileType: 'CSV',
    createdDate: '2024-03-01',
    createdTime: '16:20',
    status: 'processing',
    totalRows: 3,
    fileSize: '專案經理',
    creator: '專案經理',
    year: '2024',
    month: '03',
    columns: '姓名, 年齡, 部位'
  }
];

export const ExportCenterPage: React.FC = () => {
  const [quickExportFormat, setQuickExportFormat] = useState('Excel');
  const [includeDate, setIncludeDate] = useState(true);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [showRecords, setShowRecords] = useState(true);
  const [records] = useState(mockExportRecords);
  const [showRefreshMessage, setShowRefreshMessage] = useState(false);

  // 统计数据
  const stats = {
    completed: records.filter(r => r.status === 'completed').length,
    processing: records.filter(r => r.status === 'processing').length,
    totalExports: records.reduce((sum, r) => sum + r.totalRows, 0),
    totalFiles: records.length,
    totalSize: '3.1MB',
    totalRows: records.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.totalRows, 0)
  };

  const handleSaveSettings = () => {
    console.log('Saving export settings:', {
      format: quickExportFormat,
      includeDate,
      includeHistory,
      showRecords
    });
  };

  const handleExportAction = (action: string, recordId?: string) => {
    console.log(`Action: ${action}`, recordId ? `Record ID: ${recordId}` : '');
  };

  const handleRefresh = () => {
    setShowRefreshMessage(true);
    // 3秒后自动隐藏提示
    setTimeout(() => {
      setShowRefreshMessage(false);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      {/* 快速匯出設定 和 匯出統計 - 同一行 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 快速匯出設定 */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">快速匯出設定</h2>
          </div>
          <p className="text-sm text-gray-600 mb-6">配置資料管理頁面快速匯出功能的預設行為</p>

          <div className="space-y-6">
            {/* 匯出格式 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-700">匯出格式</div>
                <div className="text-xs text-gray-500">選擇預設格式</div>
              </div>
              <div className="flex items-center gap-3">
                <Select value={quickExportFormat} onValueChange={setQuickExportFormat}>
                  <SelectTrigger className="w-32 bg-gray-100">
                    <FileText className="w-5 h-5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Excel">Excel</SelectItem>
                    <SelectItem value="CSV">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 設定選項 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-700">日期顯文字</div>
                  <div className="text-xs text-gray-500">標題包含匯出時間</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDate}
                    onChange={(e) => setIncludeDate(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-700">記錄歷史</div>
                  <div className="text-xs text-gray-500">保存匯出歷史記錄</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeHistory}
                    onChange={(e) => setIncludeHistory(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-700">顯示記錄匯出</div>
                  <div className="text-xs text-gray-500">顯示匯出記錄詳情</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRecords}
                    onChange={(e) => setShowRecords(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* 保存按鈕 */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-blue-900">Excel - 日期顯文字</div>
                  <div className="text-sm text-blue-700">記錄歷史 • 顯示記錄匯出</div>
                </div>
                <Button onClick={handleSaveSettings} className="bg-gray-800 text-white hover:bg-gray-700">
                  儲存
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* 匯出統計 */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">匯出統計</h2>
            {/* 右上角篩選器 */}
            <div className="flex justify-end items-center gap-2">
              <span className="text-sm text-gray-600">時間範圍:</span>
              <Select defaultValue="時間範圍">
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="時間範圍">全部</SelectItem>
                  <SelectItem value="今日">今日</SelectItem>
                  <SelectItem value="本週">本週</SelectItem>
                  <SelectItem value="本月">本月</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* 刷新提示消息区域 - 预留空间避免抖动 */}
          <div className="mb-4 h-12">
            {showRefreshMessage && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-blue-700">顯示範圍：全部 （2 筆記錄）</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.completed}</div>
              <div className="text-sm text-gray-600">已完成</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.processing}</div>
              <div className="text-sm text-gray-600">進行中</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.totalExports}</div>
              <div className="text-sm text-gray-600">總匯出行數</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.totalFiles}</div>
              <div className="text-sm text-gray-600">未匯出行數</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.totalSize}</div>
              <div className="text-sm text-gray-600">資料總數</div>
            </Card>
            <Card className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.totalRows}</div>
              <div className="text-sm text-gray-600">總檔案大小</div>
            </Card>
          </div>
        </Card>
      </div>

      {/* 匯出記錄 */}
      <Card>
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">匯出記錄</h2>
        </div>
        <div className="divide-y">
          {records.map((record) => (
            <div key={record.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">{record.fileName}</h3>
                      <Badge
                        variant={record.fileType === 'Excel' ? 'default' : 'secondary'}
                        className={record.fileType === 'Excel' ? 'bg-green-600' : ''}
                      >
                        {record.fileType}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500 space-y-1">
                      <div>{record.createdDate} {record.createdTime} • {record.totalRows} 個位 • {record.fileSize}</div>
                      <div>接收者: {record.creator} 維護: {record.year}年{record.month}日</div>
                      <div className="flex items-center gap-1">
                        <span>{record.columns}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {record.status === 'completed' && (
                    <Badge variant="secondary" className="bg-green-50 text-green-700">
                      已完成
                    </Badge>
                  )}
                  {record.status === 'processing' && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                        進行中
                      </Badge>
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-800 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                      </div>
                    </div>
                  )}
                  {record.status !== 'processing' && (
                    <div>
                      <Button variant="ghost" size="sm" onClick={() => handleExportAction('view', record.id)}>
                        <Eye className="w-4 h-4 mr-1" />查看資料
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleExportAction('download', record.id)}>
                        <Download className="w-4 h-4 mr-1" />下載
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleExportAction('delete', record.id)}>
                        <Trash2 className="w-4 h-4 mr-1" />刪除
                      </Button>
                    </div>
                  )}

                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};