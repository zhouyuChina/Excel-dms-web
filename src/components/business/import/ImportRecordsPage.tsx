import React, { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, FileText, Trash2, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  deleteImportJob,
  fetchImportJobs,
  IMPORT_QUICK_FILTER_KEY,
  OPEN_MODULE_EVENT,
  retryImportJob,
  type ImportJobItem,
} from '@/lib/dmsApi';
import { toast } from 'sonner';

export const ImportRecordsPage: React.FC = () => {
  const [records, setRecords] = useState<ImportJobItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [countryFilter, setCountryFilter] = useState('所有國家');
  const [providerFilter, setProviderFilter] = useState('所有提供者');
  const [statusFilter, setStatusFilter] = useState('所有狀態');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchImportJobs();
      setRecords(res.items);
    } catch {
      toast.error('載入匯入工作失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const stats = useMemo(() => ({
    completed: records.filter(r => r.status === 'completed').length,
    processing: records.filter(r => r.status === 'processing').length,
    totalExports: records.reduce((sum, r) => sum + (r.successRows || 0), 0),
    totalFiles: records.length,
    totalSize: `${records.length} job`,
    totalRows: records.reduce((sum, r) => sum + (r.totalRows || 0), 0)
  }), [records]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setCountryFilter('所有國家');
    setProviderFilter('所有提供者');
    setStatusFilter('所有狀態');
  };

  const handleQuickNavigate = (record: ImportJobItem) => {
    localStorage.setItem(
      IMPORT_QUICK_FILTER_KEY,
      JSON.stringify({
        country: record.country,
        provider: record.provider,
        importRecord: String(record.createdAt || "").slice(0, 10),
      })
    );
    window.dispatchEvent(new CustomEvent(OPEN_MODULE_EVENT, { detail: { module: "data-management" } }));
    toast.success('已切換到資料管理並套用匯入篩選');
  };

  const handleDeleteImport = async (record: ImportJobItem) => {
    if (record.status === "processing") {
      toast.warning("進行中的匯入不可刪除，請先等待完成或失敗");
      return;
    }
    if (!window.confirm(`確定刪除這次匯入？\n- 會刪除匯入檔案與匯入紀錄\n- 會嘗試刪除本次匯入的資料\n- 已編輯過資料將自動略過\n\n${record.fileName}`)) return;
    try {
      const ret = await deleteImportJob(record.id);
      toast.success(`已刪除匯入紀錄（刪除 ${ret.deletedRows} 筆，略過 ${ret.skippedEditedRows} 筆已編輯資料）`);
      await load();
    } catch {
      toast.error('刪除失敗');
    }
  };

  const filteredRecords = records.filter((record) => {
    if (searchTerm && !record.fileName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (countryFilter !== '所有國家' && record.country !== countryFilter) return false;
    if (providerFilter !== '所有提供者' && record.provider !== providerFilter) return false;
    if (statusFilter !== '所有狀態' && record.status !== statusFilter) return false;
    return true;
  });

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
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <div className="mb-4 h-6 text-xs text-gray-500">每 5 秒自動更新匯入進度</div>

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
                  <SelectItem value="completed">completed</SelectItem>
                  <SelectItem value="processing">processing</SelectItem>
                  <SelectItem value="failed">failed</SelectItem>
                  <SelectItem value="queued">queued</SelectItem>
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

      {/* 匯入記錄 */}
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
                      <Badge variant="secondary" className="bg-gray-200 text-gray-700">job</Badge>
                      {record.status === 'processing' && (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                          分段寫入中
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 space-y-1">
                      <div className="flex items-center gap-4">
                        <span>{new Date(record.createdAt).toLocaleString()}</span>
                        <span>{record.country}</span>
                        <span>{record.provider}</span>
                        <span>{record.successRows}/{record.totalRows} 筆</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        chunk#{record.checkpointChunk} / size {record.chunkSize}
                        {record.errorPrimary ? ` · ${record.errorPrimary}` : ''}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickNavigate(record)}
                    className="gap-1"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    快速篩選
                  </Button>
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
                        <div
                          className="h-full bg-gray-800 rounded-full animate-pulse"
                          style={{ width: `${record.totalRows ? Math.min(100, Math.floor((record.processedRows / record.totalRows) * 100)) : 10}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {record.status === 'failed' && record.canRetry && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void retryImportJob(record.id).then(() => { toast.success('已重試'); void load(); })}
                    >
                      重試
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-red-700 border-red-200 hover:bg-red-50"
                    onClick={() => void handleDeleteImport(record)}
                    disabled={record.status === 'processing'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    刪除
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

