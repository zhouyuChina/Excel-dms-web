import React, { useEffect, useRef, useState } from 'react';
import { useHealth } from '@/hooks/useHealth';

interface HeaderProps {
  title: string;
}

type MenuItem = {
  label: string;
  danger?: boolean;
  note?: string; // 例如：敬請期待
};

type MenuConfig = {
  key: string;
  label: string;
  items: MenuItem[];
};

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const menus: MenuConfig[] = [
    {
      key: 'file',
      label: '檔案',
      items: [
        { label: '匯入檔案' },
        { label: '匯出資料' },
        { label: '備份' },
        { label: '備份並結束' },
        { label: '結束', danger: true },
      ],
    },
    {
      key: 'edit',
      label: '編輯',
      items: [
        { label: '復原' },
        { label: '重做' },
        { label: '複製' },
        { label: '貼上' },
      ],
    },
    {
      key: 'view',
      label: '檢視',
      items: [
        { label: '重新整理' },
        { label: '全螢幕' },
        { label: '開發者工具' },
      ],
    },
    {
      key: 'tools',
      label: '工具',
      items: [
        { label: '資料驗證', note: '敬請期待' },
        { label: '設定' },
      ],
    },
    {
      key: 'help',
      label: '說明',
      items: [
        { label: '使用手冊' },
        { label: '快速鍵' },
        { label: '關於' },
      ],
    },
  ];

  const [openKey, setOpenKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 健康檢查狀態（使用共用 hook）
  const health = useHealth(0);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpenKey(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  //（其餘 effect 保留；健康檢查改由 useHealth 管理）

  return (
    <div className="bg-gray-50 text-foreground border-b border-gray-250">
      {/* 顶部标题栏和菜单栏 */}
      <div className="bg-gray-50 px-6 py-2.5 flex items-center justify-between" ref={containerRef}>
        <div className="flex items-center space-x-32"> 
          <div>
            <h1 className="text-sm font-light select-none text-black">
              {title}
            </h1>
          </div>

          {/* 菜单栏 */}
          <div className="flex items-center space-x-3 relative">
            {menus.map((menu) => (
              <div key={menu.key} className="relative">
                <button
                  className={`text-xs px-3 py-1 rounded-[var(--radius)] text-foreground bg-transparent hover:bg-accent hover:text-accent-foreground ${
                    openKey === menu.key ? 'bg-accent text-accent-foreground' : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenKey((prev) => (prev === menu.key ? null : menu.key));
                  }}
                >
                  {menu.label}
                </button>

                {openKey === menu.key && (
                  <div className="absolute left-0 top-full px-1 mt-1 w-48 bg-popover text-popover-foreground border border-border rounded-[var(--radius)] shadow-lg z-50">
                    <div className="py-1">
                      {menu.items.map((item, idx) => (
                        <button
                          key={idx}
                          className={`w-full px-3 py-2 text-left flex rounded-[var(--radius)] hover:bg-accent/50 items-center justify-between hover:text-accent-foreground ${
                            item.danger ? 'text-destructive' : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            // 功能暫留空，僅關閉選單
                            setOpenKey(null);
                          }}
                        >
                          <span className="text-sm">{item.label}</span>
                          {item.note && (
                            <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                              {item.note}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center">
            {(() => {
              const cfg =
                health === 'loading'
                  ? { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-600', dot: 'bg-gray-400', label: '檢查中' }
                  : health === 'online'
                  ? { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700', dot: 'bg-green-600', label: 'Online' }
                  : health === 'db-issue'
                  ? { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700', dot: 'bg-yellow-600', label: '資料庫異常' }
                  : { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', dot: 'bg-red-600', label: '離線' };
              return (
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border select-none ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`}></span>
                  <span className="text-xs">{cfg.label}</span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};
