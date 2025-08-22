import React, { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, FileText, Grid3X3, CheckCircle, Upload, Download, Shield, BarChart3, Bell, Trash2, Edit3, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    <aside className={`bg-gray-800 text-white transition-all duration-300 ${collapsed ? "w-18" : "w-64"}`}>
      <div className="flex flex-col h-full">
        {/* 收缩按钮 */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <div className={`${collapsed ? "hidden" : "block"} text-sm font-medium`}>
            系统导航
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="w-8 h-8 p-0 text-white hover:bg-gray-700"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </Button>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onModuleChange(item.id)}
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeModule === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              } ${collapsed ? "justify-center" : ""}`}
            >
              <item.icon size={collapsed ? 20 : 16} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* 通知展示区域 */}
        {!collapsed && (
          <div className="p-4 border-t border-gray-700">
            <button
              onClick={() => setNotificationsExpanded(!notificationsExpanded)}
              className="w-full flex items-center justify-between text-sm font-medium text-gray-300 mb-2"
            >
              <div className="flex items-center space-x-2">
                <Bell size={16} />
                <span>通知展示</span>
              </div>
              <ChevronDown size={16} className={`transition-transform ${notificationsExpanded ? 'rotate-180' : ''}`} />
            </button>
            
            {notificationsExpanded && (
              <div className="space-y-4">
                {/* 基本通知 */}
                <div>
                  <h4 className="text-xs text-gray-400 mb-2">基本通知</h4>
                  <div className="space-y-1">
                    <button className="w-full flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-700 text-sm">
                      <div className="w-4 h-4 bg-green-500 rounded flex items-center justify-center">
                        <CheckCircle size={12} className="text-white" />
                      </div>
                      <span>成功通知</span>
                    </button>
                    <button className="w-full flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-700 text-sm">
                      <div className="w-4 h-4 bg-yellow-500 rounded flex items-center justify-center">
                        <span className="text-white text-xs">!</span>
                      </div>
                      <span>警告通知</span>
                    </button>
                    <button className="w-full flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-700 text-sm">
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
                    <button className="w-full flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-700 text-sm">
                      <div className="w-4 h-4 bg-red-500 rounded flex items-center justify-center">
                        <span className="text-white text-xs">S</span>
                      </div>
                      <span>帶操作按鈕</span>
                    </button>
                    <button className="w-full flex items-center space-x-2 px-2 py-1 rounded hover:bg-gray-700 text-sm">
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
            )}
          </div>
        )}

        {/* 系统状态 */}
        {!collapsed && (
          <div className="p-4 border-t border-gray-700">
            <h4 className="text-xs text-gray-400 mb-2">系統狀態</h4>
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
