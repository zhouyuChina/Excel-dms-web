import React, { useEffect, useMemo, useState } from 'react';
import {
  Database,
  Upload,
  Download,
  RotateCcw,
  Play,
  CheckCircle,
  Clock,
  RefreshCw,
  Calendar,
  HardDrive,
  Trash2
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  createRecoverySnapshot,
  deleteRecoverySnapshot,
  fetchRecoverySnapshots,
  previewRestoreRecoverySnapshot,
  recoveryDownloadUrl,
  restoreRecoverySnapshot,
  uploadRecoverySnapshot,
  type RecoverySnapshotItem
} from '@/lib/dmsApi';
import { toast } from 'sonner';

export const BackupRestorePage: React.FC = () => {
  const [items, setItems] = useState<RecoverySnapshotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'full' | 'selected'>('full');
  const [selectedCuidsText, setSelectedCuidsText] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchRecoverySnapshots();
      setItems(res.items);
    } catch {
      toast.error('載入備份記錄失敗（需 admin 登入）');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      backupCount: items.length,
      totalSize: `${Math.max(1, items.length)} 檔`,
      todayBackups: items.filter((x) => new Date(x.createdAt).toDateString() === today).length
    };
  }, [items]);

  const handleManualBackup = async () => {
    setWorking(true);
    try {
      const label = `手動備份_${new Date().toISOString().slice(0, 19).replace('T', '_')}`;
      const r = await createRecoverySnapshot(label);
      toast.success(`建立快照成功（${r.rowCount} 筆）`);
      await load();
    } catch {
      toast.error('建立快照失敗');
    } finally {
      setWorking(false);
    }
  };

  const handleUploadBackup: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadRecoverySnapshot(file, `上傳_${file.name}`);
      toast.success('上傳備份成功');
      await load();
    } catch {
      toast.error('上傳備份失敗');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDownloadLatest = () => {
    const latest = items[0];
    if (!latest) return;
    window.open(recoveryDownloadUrl(latest.id), '_blank');
  };

  const handleRestore = async () => {
    const latest = items[0];
    if (!latest) return;
    const selectedCuids = selectedCuidsText
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (restoreMode === 'selected' && selectedCuids.length === 0) {
      toast.error('請輸入要還原的 CUID（逗號分隔）');
      return;
    }
    if (!window.confirm(`還原到最新備份「${latest.label}」？`)) return;
    setWorking(true);
    try {
      const r = await restoreRecoverySnapshot(latest.id, restoreMode, selectedCuids);
      toast.success(`還原完成（${r.rowCount} 筆）`);
      await load();
    } catch {
      toast.error('還原失敗');
    } finally {
      setWorking(false);
    }
  };

  const handleDownloadBackup = (backupId: string) => {
    window.open(recoveryDownloadUrl(backupId), '_blank');
  };

  const handleRestoreBackup = async (backupId: string) => {
    const selectedCuids = selectedCuidsText
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (restoreMode === 'selected' && selectedCuids.length === 0) {
      toast.error('請輸入要還原的 CUID（逗號分隔）');
      return;
    }
    if (!window.confirm('確定還原這份備份？目前資料會被覆蓋。')) return;
    setWorking(true);
    try {
      const r = await restoreRecoverySnapshot(backupId, restoreMode, selectedCuids);
      toast.success(`還原完成（${r.rowCount} 筆）`);
      await load();
    } catch {
      toast.error('還原失敗');
    } finally {
      setWorking(false);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!window.confirm('確定刪除此備份？')) return;
    try {
      await deleteRecoverySnapshot(backupId);
      toast.success('已刪除備份');
      await load();
    } catch {
      toast.error('刪除備份失敗');
    }
  };

  const handlePreviewRestore = async (snapshotId: string) => {
    const cuids = selectedCuidsText
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    try {
      const p = await previewRestoreRecoverySnapshot(snapshotId, restoreMode, cuids);
      setPreviewText(
        `預估影響 ${p.affectedRows} 筆（快照共 ${p.snapshotRows} 筆，模式：${p.mode === 'full' ? '全量' : '指定CUID'}）`
      );
    } catch {
      toast.error('預覽失敗');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">建立備份</h3>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-gray-600">建立當前資料的完整備份</p>

            <Button
              onClick={handleManualBackup}
              disabled={working}
              className="w-full bg-gray-800 text-white hover:bg-gray-900 flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              建立手動備份
            </Button>

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700">系統每日凌晨2點自動備份（待實作）</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>建議重要操作前手動備份</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold">備份統計</h3>
          </div>

          <div className="space-y-4">
            <div className="text-center bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.backupCount}</div>
              <div className="text-sm text-gray-600">備份份數</div>
            </div>

            <div className="text-center bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-blue-600 mb-1">{stats.totalSize}</div>
              <div className="text-sm text-gray-600">儲存大小</div>
            </div>

            <div className="text-center bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-600 mb-1">{stats.todayBackups}</div>
              <div className="text-sm text-gray-600">今日備份</div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold">快速操作</h3>
          </div>

          <div className="space-y-3">
            <label className="w-full">
            <Button variant="outline" asChild className="w-full flex items-center gap-2" disabled={uploading}>
              <span>
              <Upload className="w-4 h-4" />
              {uploading ? '上傳中…' : '上傳備份檔案'}
              </span>
            </Button>
            <input type="file" accept=".json" className="hidden" onChange={handleUploadBackup} />
            </label>

            <Button variant="outline" onClick={handleDownloadLatest} className="w-full flex items-center gap-2">
              <Download className="w-4 h-4" />
              下載最新備份
            </Button>

            <Button
              variant="outline"
              onClick={handleRestore}
              disabled={working || items.length === 0}
              className="w-full flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              還原到上個版本
            </Button>
            <div className="text-xs text-gray-500 mt-1">
              還原模式：
              <select
                className="ml-2 border rounded px-1 py-0.5"
                value={restoreMode}
                onChange={(e) => setRestoreMode(e.target.value as 'full' | 'selected')}
              >
                <option value="full">全量覆蓋</option>
                <option value="selected">指定 CUID</option>
              </select>
            </div>
            {restoreMode === 'selected' && (
              <input
                className="w-full border rounded px-2 py-1 text-xs"
                placeholder="輸入 CUID（逗號分隔）"
                value={selectedCuidsText}
                onChange={(e) => setSelectedCuidsText(e.target.value)}
              />
            )}
            {!!previewText && <div className="text-xs text-blue-600">{previewText}</div>}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold">備份記錄</h3>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="text-sm text-gray-500">載入中…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-gray-500">尚無備份紀錄</div>
          ) : (
            items.map((backup) => (
              <div
                key={backup.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{backup.label}</span>
                        <Badge className="text-xs bg-blue-600 text-white">快照</Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        {new Date(backup.createdAt).toLocaleString()} • {backup.rowCount} 行
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-600">已完成</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadBackup(backup.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Download className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRestoreBackup(backup.id)}
                      disabled={working}
                      className="h-8 w-8 p-0"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handlePreviewRestore(backup.id)}
                      className="h-8 px-2 text-xs"
                    >
                      預覽
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteBackup(backup.id)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};