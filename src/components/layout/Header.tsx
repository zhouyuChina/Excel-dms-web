import React from 'react';

interface HeaderProps {
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  return (
    <div className="bg-gray-800 text-white border-b border-gray-700">
      {/* 顶部标题栏和菜单栏 */}
      <div className="bg-gray-800 px-6 py-2 flex items-center justify-between">
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
          <div className="flex items-center space-x-6">
            {["檔案", "編輯", "檢視", "工具", "說明"].map((menuItem) => (
              <button
                key={menuItem}
                className="text-sm text-white hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-700"
              >
                {menuItem}
              </button>
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
