import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Download, Eye, Trash2, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  fetchExportList,
  deleteExportJob,
  exportDownloadUrl,
  fetchJobResult,
  jobResultFileDownloadUrl,
  type ExportListItem,
} from '@/lib/dmsApi';
import { toast } from 'sonner';
import {
  fetchUnifiedTasksWithFilter,
  retryTaskIfExport,
  type UnifiedTaskItem,
} from '@/lib/jobCenter';

export const ExportCenterPage: React.FC = () => {
  const [quickExportFormat, setQuickExportFormat] = useState('Excel');
  const [includeDate, setIncludeDate] = useState(true);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [showRecords, setShowRecords] = useState(true);
  const [records, setRecords] = useState<ExportListItem[]>([]);
  const [exportTasks, setExportTasks] = useState<UnifiedTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRefreshMessage, setShowRefreshMessage] = useState(false);
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [taskFiles, setTaskFiles] = useState<Record<string, Array<{ fileName: string; rowCount?: number; part?: number }>>>({});
  const [loadingTaskFilesId, setLoadingTaskFilesId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ items }, tasks] = await Promise.all([
        fetchExportList(),
        fetchUnifiedTasksWithFilter({
          limit: 100,
          source: "export",
          status: "all",
        }),
      ]);
      setRecords(items);
      setExportTasks(tasks);
    } catch {
      toast.error('無法載入匯出紀錄');
      setRecords([]);
      setExportTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const inProgressCount = exportTasks.filter((x) => x.status === "queued" || x.status === "processing").length;

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load();
    }, inProgressCount > 0 ? 1500 : 5000);
    return () => window.clearInterval(timer);
  }, [inProgressCount, load]);

  const stats = {
    completed: records.length,
    processing: 0,
    totalExports: records.reduce((sum, r) => sum + r.rowCount, 0),
    totalFiles: records.length,
    totalSize: '—',
    totalRows: records.reduce((sum, r) => sum + r.rowCount, 0)
  };

  const handleSaveSettings = () => {
    toast.message('設定已儲存（本機偏好，後續可接 API）');
  };

  const handleExportAction = async (action: string, recordId?: string) => {
    if (action === 'download' && recordId) {
      window.open(exportDownloadUrl(recordId), '_blank', 'noopener,noreferrer');
      return;
    }
    if (action === 'delete' && recordId) {
      if (!window.confirm('刪除此匯出紀錄？將一併解除相關客戶的匯出標記（若無其他匯出）。')) return;
      try {
        await deleteExportJob(recordId);
        toast.success('已刪除');
        void load();
      } catch {
        toast.error('刪除失敗');
      }
      return;
    }
    if (action === 'view' && recordId) {
      window.open(exportDownloadUrl(recordId), '_blank', 'noopener,noreferrer');
    }
  };

  const handleRefresh = () => {
    void load();
    setShowRefreshMessage(true);
    setTimeout(() => setShowRefreshMessage(false), 2000);
  };

  const handleRetryExport = async (task: UnifiedTaskItem) => {
    if (!(task.source === "export" && task.status === "failed")) return;
    try {
      setRetryingTaskId(task.id);
      await retryTaskIfExport(task);
      toast.success("已送出匯出重試");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "匯出重試失敗");
    } finally {
      setRetryingTaskId(null);
    }
  };

  const handleToggleTaskFiles = async (task: UnifiedTaskItem) => {
    if (expandedTaskId === task.id) {
      setExpandedTaskId(null);
      return;
    }
    setExpandedTaskId(task.id);
    if (taskFiles[task.id]) return;
    try {
      setLoadingTaskFilesId(task.id);
      const result = await fetchJobResult(task.id);
      const files = Array.isArray(result.result?.files) ? result.result.files : [];
      setTaskFiles((prev) => ({ ...prev, [task.id]: files }));
    } catch {
      toast.error("無法讀取分檔清單");
    } finally {
      setLoadingTaskFilesId(null);
    }
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
                <span className="text-sm text-blue-700">顯示範圍：全部 （{records.length} 筆記錄）</span>
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
        <div className="p-4 border-b bg-gray-50/60">
          <div className="text-sm font-medium text-gray-800 mb-2">任務狀態（含排隊 / 進行中）</div>
          {exportTasks.length === 0 ? (
            <div className="text-xs text-gray-500">目前沒有匯出任務</div>
          ) : (
            <div className="space-y-2">
              {exportTasks.slice(0, 6).map((task) => {
                const percent =
                  task.totalRows > 0
                    ? Math.min(100, Math.floor((task.processedRows / task.totalRows) * 100))
                    : task.status === "completed"
                      ? 100
                      : task.status === "failed"
                        ? 0
                        : 12;
                const statusText =
                  task.status === "queued"
                    ? "排隊中"
                    : task.status === "processing"
                      ? "進行中"
                      : task.status === "completed"
                        ? "已完成"
                        : "失敗";
                return (
                  <div key={task.id} className="rounded border bg-white p-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="font-medium truncate">{task.title}</div>
                      <div className="text-gray-600">{statusText}</div>
                    </div>
                    <div className="mt-1 h-1.5 bg-gray-200 rounded overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: `${percent}%` }} />
                    </div>
                    {(task.status === "queued" && (task.queuePosition || task.estimatedWaitSec)) && (
                      <div className="mt-1 text-[11px] text-gray-500">
                        排隊#{task.queuePosition || "?"} · 約{task.estimatedWaitSec || 0}s
                      </div>
                    )}
                    {task.status === "failed" && (
                      <div className="mt-1">
                        <button
                          className="text-[11px] text-blue-700 hover:underline disabled:opacity-60"
                          disabled={retryingTaskId === task.id}
                          onClick={() => void handleRetryExport(task)}
                        >
                          {retryingTaskId === task.id ? "重試中…" : "重試匯出"}
                        </button>
                      </div>
                    )}
                    {task.status === "completed" && (
                      <div className="mt-1 flex items-center gap-3 text-[11px]">
                        <button
                          className="text-blue-700 hover:underline"
                          onClick={() => void handleToggleTaskFiles(task)}
                        >
                          {expandedTaskId === task.id ? "收合分檔" : "查看分檔"}
                        </button>
                        <button
                          className="text-blue-700 hover:underline"
                          onClick={() => {
                            void (async () => {
                              try {
                                const result = await fetchJobResult(task.id);
                                const files = Array.isArray(result.result?.files) ? result.result.files : [];
                                if (files.length > 0) {
                                  for (const f of files) {
                                    const fileName = String(f.fileName || "").trim();
                                    if (!fileName) continue;
                                    window.open(
                                      jobResultFileDownloadUrl(task.id, fileName),
                                      "_blank",
                                      "noopener,noreferrer"
                                    );
                                  }
                                  return;
                                }
                                const exportId = String(result.result?.exportId || "").trim();
                                if (!exportId) {
                                  toast.error("找不到可下載檔案");
                                  return;
                                }
                                window.open(exportDownloadUrl(exportId), "_blank", "noopener,noreferrer");
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "下載失敗");
                              }
                            })();
                          }}
                        >
                          全部下載
                        </button>
                      </div>
                    )}
                    {expandedTaskId === task.id && (
                      <div className="mt-2 rounded border bg-gray-50 p-2">
                        {loadingTaskFilesId === task.id ? (
                          <div className="text-[11px] text-gray-500">讀取分檔中…</div>
                        ) : (taskFiles[task.id] || []).length === 0 ? (
                          <div className="text-[11px] text-gray-500">單檔任務或暫無分檔資訊</div>
                        ) : (
                          <div className="space-y-1">
                            {taskFiles[task.id]!.map((file) => (
                              <div key={file.fileName} className="flex items-center justify-between gap-2 text-[11px]">
                                <div className="truncate">
                                  Part {file.part || "?"} · {file.fileName} · {file.rowCount ?? 0} rows
                                </div>
                                <button
                                  className="text-blue-700 hover:underline shrink-0"
                                  onClick={() =>
                                    window.open(
                                      jobResultFileDownloadUrl(task.id, file.fileName),
                                      "_blank",
                                      "noopener,noreferrer"
                                    )
                                  }
                                >
                                  下載
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="divide-y">
          {loading && (
            <div className="p-8 text-center text-sm text-gray-500">載入中…</div>
          )}
          {!loading && records.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-500">尚無匯出紀錄</div>
          )}
          {!loading &&
            records.map((record) => (
            <div key={record.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">{record.fileName}</h3>
                      <Badge variant="secondary">CSV</Badge>
                    </div>
                    <div className="text-sm text-gray-500 space-y-1">
                      <div>
                        {new Date(record.createdAt).toLocaleString('zh-TW')} • {record.rowCount} 筆
                      </div>
                      <div>
                        接收者: {record.recipient || '—'}{' '}
                        {record.remarks ? `• 備註: ${record.remarks}` : ''}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Badge variant="secondary" className="bg-green-50 text-green-700">
                    已完成
                  </Badge>
                  <div>
                    <Button variant="ghost" size="sm" onClick={() => handleExportAction('view', record.id)}>
                      <Eye className="w-4 h-4 mr-1" />查看
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleExportAction('download', record.id)}>
                      <Download className="w-4 h-4 mr-1" />下載
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleExportAction('delete', record.id)}>
                      <Trash2 className="w-4 h-4 mr-1" />刪除
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};