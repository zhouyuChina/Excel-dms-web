import React, { useState } from 'react';
import { Search, Eye, Trash2, FileText, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ImportRecord {
  id: string;
  fileName: string;
  fileType: string;
  createdDate: string;
  createdTime: string;
  status: 'completed' | 'processing' | 'failed';
  country: string;
  company: string;
  totalRows: number;
  columns: string[];
  description?: string;
  size?: string;
}

const mockImportRecords: ImportRecord[] = [
  {
    id: '1',
    fileName: '員工資料_2024Q1.xlsx',
    fileType: 'Excel',
    createdDate: '2024-01-15',
    createdTime: '14:30:25',
    status: 'completed',
    country: '台灣',
    company: '人事部',
    totalRows: 150,
    columns: ['姓名', '年齡', '部位', '+2 個欄位'],
    description: '更新命名欄位：姓名 → 姓名_2',
    size: '專案資料'
  },
  {
    id: '2',
    fileName: '客戶清單.csv',
    fileType: 'CSV',
    createdDate: '2024-01-12',
    createdTime: '09:15:30',
    status: 'completed',
    country: '美國',
    company: '招商公司',
    totalRows: 89,
    columns: ['客戶名稱', '聯絡電話', '地址', '業務代表'],
    description: '備註：第一季度客戶資料匯入'
  },
  {
    id: '3',
    fileName: '產品庫存_2024Q1.xlsx',
    fileType: 'Excel',
    createdDate: '2024-01-10',
    createdTime: '16:45:12',
    status: 'processing',
    country: '日本',
    company: '公司',
    totalRows: 0,
    columns: ['產品編號', '產品名稱', '庫存數量', '價格'],
    description: ''
  }
];

export const ImportRecordsPage: React.FC = () => {
  const [records] = useState(mockImportRecords);
  const [searchTerm, setSearchTerm] = useState('');
  const [countryFilter, setCountryFilter] = useState('所有國家');
  const [providerFilter, setProviderFilter] = useState('所有提供者');
  const [statusFilter, setStatusFilter] = useState('所有狀態');
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

  const handleAction = (action: string, recordId: string) => {
    console.log(`Action: ${action}, Record ID: ${recordId}`);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setCountryFilter('所有國家');
    setProviderFilter('所有提供者');
    setStatusFilter('所有狀態');
  };

  const filteredRecords = records.filter(record =>
    record.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRefresh = () => {
    setShowRefreshMessage(true);
    // 3秒后自动隐藏提示
    setTimeout(() => {
      setShowRefreshMessage(false);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 匯出統計 */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">匯入統計</h2>
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

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">搜尋與篩選</h3>

          {/* 搜索框 */}
          <div className="mb-4">
            <div className="relative">
              <Input
                placeholder="搜尋檔案名稱，提供者或國家..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-50"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            </div>
          </div>

          {/* 筛选选项 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="所有國家" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="所有國家">所有國家</SelectItem>
                  <SelectItem value="台灣">台灣</SelectItem>
                  <SelectItem value="美國">美國</SelectItem>
                  <SelectItem value="日本">日本</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="所有提供者" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="所有提供者">所有提供者</SelectItem>
                  <SelectItem value="人事部">人事部</SelectItem>
                  <SelectItem value="招商公司">招聘公司</SelectItem>
                  <SelectItem value="分公司">分公司</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="所有狀態" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="所有狀態">所有狀態</SelectItem>
                  <SelectItem value="已完成">已完成</SelectItem>
                  <SelectItem value="進行中">進行中</SelectItem>
                  <SelectItem value="錯誤">錯誤</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 重置按鈕 */}
          <div className="flex justify-center">
            <Button
              onClick={handleResetFilters}
              className="w-32 bg-blue-600 text-white hover:bg-blue-700"
            >
              重置篩選
            </Button>
          </div>
        </Card>
      </div>

      {/* 汇入记录 */}
      <Card>
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">匯入記錄</h2>
          <span className="text-sm text-gray-500">{filteredRecords.length} 筆記錄</span>
        </div>
        <div className="divide-y">
          {filteredRecords.map((record) => (
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
                        className={record.fileType === 'Excel' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}
                      >
                        {record.fileType}
                      </Badge>
                      {record.status === 'processing' && (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                          備份暫未完成
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 space-y-1">
                      <div className="flex items-center gap-4">
                        <span>{record.createdDate} {record.createdTime}</span>
                        <span>{record.country}</span>
                        <span>{record.company}</span>
                        {record.status === 'completed' && <span>{record.totalRows} 筆資料</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        {record.columns.map((col, index) => (
                          <span key={index}>{col}{index < record.columns.length - 1 ? ', ' : ''}</span>
                        ))}
                      </div>
                      {record.description && (
                        <div className="text-orange-600">{record.description}</div>
                      )}
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
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleAction('view', record.id)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleAction('download', record.id)}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleAction('delete', record.id)}>
                        <Trash2 className="w-4 h-4" />
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

