import React, { useEffect, useRef, useState } from 'react';

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

  return (
    <div className="bg-gray-800 text-white border-b border-gray-700">
      {/* 顶部标题栏和菜单栏 */}
      <div className="bg-gray-800 px-6 py-2 flex items-center justify-between" ref={containerRef}>
        <div className="flex items-center space-x-8">
          <div>
            <h1 className="text-lg font-semibold text-white">
              {title}
            </h1>
            <p className="text-sm text-gray-300">
              Powered by Excel Enterprise Data Management
            </p>
          </div>

          {/* 菜单栏 */}
          <div className="flex items-center space-x-2 relative">
            {menus.map((menu) => (
              <div key={menu.key} className="relative">
                <button
                  className={`text-sm px-3 py-1 rounded hover:bg-gray-700 ${
                    openKey === menu.key ? 'bg-gray-700' : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenKey((prev) => (prev === menu.key ? null : menu.key));
                  }}
                >
                  {menu.label}
                </button>

                {openKey === menu.key && (
                  <div className="absolute left-0 top-full mt-1 w-48 bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50">
                    <div className="py-1">
                      {menu.items.map((item, idx) => (
                        <button
                          key={idx}
                          className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            item.danger ? 'text-red-600 dark:text-red-400' : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            // 功能暫留空，僅關閉選單
                            setOpenKey(null);
                          }}
                        >
                          <span className="text-sm">{item.label}</span>
                          {item.note && (
                            <span className="text-xs bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full">
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
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-green-400">Online</span>
          </div>
        </div>
      </div>
    </div>
  );
};
