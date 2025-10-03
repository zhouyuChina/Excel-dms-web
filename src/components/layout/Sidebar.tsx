import React, { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, FileText, Grid3X3, CheckCircle, Upload, Download, Shield, BarChart3, Bell, Trash2, Edit3, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeModule: string;
  onModuleChange: (module: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  activeModule,
  onModuleChange,
}) => {
  const [notificationsExpanded, setNotificationsExpanded] = useState(true);
  const handleRefreshApp = () => {
    window.location.assign('/');
  };
  const menuItems = [
    { id: 'data-management', label: '資料管理', icon: FileText },
    { id: 'field-management', label: '欄位管理', icon: Grid3X3 },
    { id: 'data-validation', label: '資料驗證', icon: CheckCircle },
    { id: 'export-center', label: '匯出中心', icon: Upload },
    { id: 'import-records', label: '匯入紀錄', icon: Download },
    { id: 'backup-restore', label: '備份還原', icon: Shield },
    { id: 'statistical-analysis', label: '統計分析', icon: BarChart3 },
    { id: 'document-center', label: '文檔中心', icon: FileText },
  ];

  return (
    <aside className={`bg-gray-50 border-r border-gray-250 text-foreground transition-all duration-300 ${collapsed ? "w-18" : "w-56"}`}>
      <div className="flex flex-col h-full">
        {/* 收缩按钮 */}
        <div className={`px-4 pt-4 border-b border-gray-50 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
         <div className={`${collapsed ? 'hidden' : 'block'}`}>
         <Button
          variant="ghost"
             size="icon"
             onClick={handleRefreshApp}
             className="w-10 h-10 p-0 hover:bg-accent hover:text-accent-foreground"
             title="重新整理">
            <RefreshCw size={16} />
         </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="w-10 h-10 p-0 text-gray-700 hover:bg-gray-200"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </Button>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 p-4 space-y-1.5">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onModuleChange(item.id)}
              className={`flex h-9 w-full items-center space-x-3 px-3 rounded-[var(--radius)] text-sm transition-colors ${
                activeModule === item.id
                  ? 'bg-black text-white'
                  : 'text-gray-900 hover:bg-accent hover:text-accent-foreground'
              } ${collapsed ? "justify-center" : ""}`}
            >
              <item.icon size={collapsed ? 16 : 16} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* 通知展示区域 */}
        {!collapsed && (
          <div className="p-4 border-t border-gray-250">
            <button
              onClick={() => setNotificationsExpanded(!notificationsExpanded)}
              className="w-full flex items-center justify-between text-sm font-medium text-gray-500"
            >
              <div className="flex items-center space-x-2">
                <Bell size={16} />
                <span>通知展示</span>
              </div>
               {notificationsExpanded ? (
                <ChevronDown size={16} className="transition-transform" />) : (
                <ChevronUp size={16} className="transition-transform" />)}
            </button>
            
            {notificationsExpanded && (
              <div className="max-h-64 overflow-y-auto pr-1"> 
               <div className="space-y-4 p-3">
                {/* 基本通知 */}
                <div>
                  <h4 className="text-xs text-gray-400 mb-2">基本通知</h4>
                  <div className="space-y-1">
                    <button className="w-full flex items-center space-x-2 px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground text-xs">
                      <div className="w-4 h-4 bg-green-500 rounded flex items-center justify-center">
                        <CheckCircle size={12} className="text-white" />
                      </div>
                      <span>成功通知</span>
                    </button>
                    <button className="w-full flex items-center space-x-2 px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground text-xs">
                      <div className="w-4 h-4 bg-yellow-500 rounded flex items-center justify-center">
                        <span className="text-white text-xs">!</span>
                      </div>
                      <span>警告通知</span>
                    </button>
                    <button className="w-full flex items-center space-x-2 px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground text-xs">
                      <div className="w-4 h-4 bg-red-500 rounded flex items-center justify-center">
                        <span className="text-white text-xs">×</span>
                      </div>
                      <span>錯誤通知</span>
                    </button>
                  </div>
                </div>

                {/* 互动通知 */}
                <div>
                  <h4 className="text-xs text-gray-400 mb-2">互動通知</h4>
                  <div className="space-y-1">
                    <button className="w-full flex items-center space-x-2 px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground text-xs">
                      <div className="w-4 h-4 bg-red-500 rounded flex items-center justify-center">
                        <span className="text-white text-xs">S</span>
                      </div>
                      <span>帶操作按鈕</span>
                    </button>
                    <button className="w-full flex items-center space-x-2 px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground text-xs">
                      <Link size={16} className="text-gray-400" />
                      <span>可點擊通知</span>
                    </button>
                  </div>
                </div>

                {/* 控制功能 */}
                <div>
                  <h4 className="text-xs text-gray-400 mb-2">控制功能</h4>
                  <div className="space-y-2">
                    <Button variant="destructive" size="sm" className="w-full text-xs">
                      <Trash2 size={14} className="mr-1" />
                      清除通知
                    </Button>
                    <Button variant="outline" size="sm" className="w-full text-xs bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
                      <Edit3 size={14} className="mr-1" />
                      測試通知
                    </Button>
                  </div>
                </div>

                {/* 功能说明 */}
                <div className="text-xs text-gray-400">
                  <h4 className="mb-1">功能說明：</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>懸停暫停自動消失</li>
                    <li>點擊執行自定義操作</li>
                  </ul>
                </div>
              </div>
             </div>
            )}
          </div>
        )}

        {/* 系统状态 */}
        {!collapsed && (
          <div className="p-4 border-t border-gray-250">
            <h4 className="text-xs text-gray-500 mb-2">系統狀態</h4>
            <div className="space-y-1 text-sm">
              <div>資料行數：1,234</div>
              <div>存儲使用：2.1MB</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
