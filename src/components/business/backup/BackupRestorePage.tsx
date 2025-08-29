import React from 'react';
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

// 模拟数据
const mockBackupStats = {
  backupCount: 3,
  totalSize: '5.8MB',
  todayBackups: 1
};

const mockBackupRecords = [
  {
    id: '1',
    name: '每日自動備份_2024-03-01',
    type: 'auto',
    date: '2024-03-01',
    time: '02:00',
    size: '2.1MB',
    records: '1,234',
    status: 'completed'
  },
  {
    id: '2',
    name: '手動備份_重要資料',
    type: 'manual',
    date: '2024-02-28',
    time: '14:30',
    size: '1.8MB',
    records: '1,156',
    status: 'completed'
  },
  {
    id: '3',
    name: '每日自動備份_2024-02-28',
    type: 'auto',
    date: '2024-02-28',
    time: '02:00',
    size: '1.9MB',
    records: '1,089',
    status: 'completed'
  }
];

export const BackupRestorePage: React.FC = () => {
  const handleManualBackup = () => {
    console.log('执行手动备份');
  };

  const handleUploadBackup = () => {
    console.log('上传备份档案');
  };

  const handleDownloadLatest = () => {
    console.log('下载最新备份');
  };

  const handleRestore = () => {
    console.log('还原到上个版本');
  };

  const handleDownloadBackup = (backupId: string) => {
    console.log('下载备份:', backupId);
  };

  const handleRestoreBackup = (backupId: string) => {
    console.log('还原备份:', backupId);
  };

  const handleDeleteBackup = (backupId: string) => {
    console.log('删除备份:', backupId);
  };

  return (
    <div className="space-y-6">
      {/* 顶部三列布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 建立備份 */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">建立備份</h3>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm text-gray-600">建立當前資料的完整備份</p>
            
            <Button 
              onClick={handleManualBackup}
              className="w-full bg-gray-800 text-white hover:bg-gray-900 flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              建立手動備份
            </Button>
            
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700">系統每日凌晨2點自動備份</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>建議重要操作前手動備份</span>
              </div>
            </div>
          </div>
        </Card>

        {/* 備份統計 */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold">備份統計</h3>
          </div>
          
          <div className="space-y-4">
            {/* 備份份數 */}
            <div className="text-center bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {mockBackupStats.backupCount}
              </div>
              <div className="text-sm text-gray-600">備份份數</div>
            </div>
            
            {/* 储存大小 */}
            <div className="text-center bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-blue-600 mb-1">
                {mockBackupStats.totalSize}
              </div>
              <div className="text-sm text-gray-600">儲存大小</div>
            </div>
            
            {/* 今日備份 */}
            <div className="text-center bg-gray-50 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-600 mb-1">
                {mockBackupStats.todayBackups}
              </div>
              <div className="text-sm text-gray-600">今日備份</div>
            </div>
          </div>
        </Card>

        {/* 快速操作 */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold">快速操作</h3>
          </div>
          
          <div className="space-y-3">
            <Button 
              variant="outline" 
              onClick={handleUploadBackup}
              className="w-full flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              上傳備份檔案
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleDownloadLatest}
              className="w-full flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              下載最新備份
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleRestore}
              className="w-full flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              還原到上個版本
            </Button>
          </div>
        </Card>
      </div>

      {/* 備份記錄 */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-semibold">備份記錄</h3>
        </div>
        
        <div className="space-y-4">
          {mockBackupRecords.map((backup) => (
            <div 
              key={backup.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {backup.name}
                      </span>
                      {backup.type === 'auto' && (
                        <Badge className="text-xs bg-gray-800 text-white">
                          自動
                        </Badge>
                      )}
                      {backup.type === 'manual' && (
                        <Badge className="text-xs bg-blue-600 text-white">
                          手動
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {backup.date} {backup.time} • {backup.size} • {backup.records} 行
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">
                    已完成
                  </span>
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
                    onClick={() => handleRestoreBackup(backup.id)}
                    className="h-8 w-8 p-0"
                  >
                    <RotateCcw className="w-4 h-4" />
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
          ))}
        </div>
      </Card>
    </div>
  );
};