import React from 'react';
import { ChevronLeft, ChevronRight, FileText, Grid3X3, Upload, Download, Shield, ClipboardList, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { authLogout } from '@/lib/dmsApi';

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
  const role = (localStorage.getItem("userRole") || "viewer") as "admin" | "editor" | "viewer";
  const isAdmin = role === "admin";
  const handleRefreshApp = () => {
    window.location.assign('/');
  };
  const menuItems = [
    { id: 'data-management', label: '資料管理', icon: FileText },
    { id: 'field-management', label: '欄位管理', icon: Grid3X3 },
    { id: 'invalid-quarantine', label: '隔離審核', icon: AlertTriangle },
    { id: 'export-center', label: '匯出中心', icon: Upload },
    { id: 'import-records', label: '匯入紀錄', icon: Download },
    { id: 'backup-restore', label: '備份還原', icon: Shield },
    { id: 'audit-logs', label: '稽核紀錄', icon: ClipboardList },
  ].filter((item) => (isAdmin ? true : item.id !== "backup-restore" && item.id !== "audit-logs"));

  return (
    <aside className={`bg-gray-50 border-r border-gray-250 text-foreground transition-all duration-300 ${collapsed ? "w-18" : "w-56"}`}>
      <div className="flex flex-col h-full">
        {/* 收缩按钮 */}
        <div className={`px-4 pt-4 border-b border-gray-50 flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
         <div className={`${collapsed ? 'hidden' : 'block'}`}>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefreshApp}
                className="w-10 h-10 p-0 hover:bg-accent hover:text-accent-foreground"
                title="重新整理"
              >
                <RefreshCw size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void authLogout();
                  localStorage.removeItem("token");
                  localStorage.removeItem("refreshToken");
                  localStorage.removeItem("userRole");
                  localStorage.removeItem("username");
                  window.location.assign("/login");
                }}
                className="text-xs"
              >
                登出
              </Button>
            </div>
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
      </div>
    </aside>
  );
};