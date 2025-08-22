import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-800 text-white px-6 py-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-4">
          {/* 系统状态 */}
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>就緒</span>
          </div>
          
          <span>•</span>
          
          {/* 应用名称和版本 */}
          <span>企業資料管理系統 v1.0.0</span>
          
          <span>•</span>
          
          {/* 数据库状态 */}
          <div className="flex items-center space-x-2">
            <span>資料庫:</span>
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-green-400">已連線</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* 用户信息 */}
          <span>使用者:管理員</span>
          
          <span>•</span>
          
          {/* 日期和时间 */}
          <span>2025/08/22 上午11:35</span>
          
          <span>•</span>
          
          {/* 性能指标 */}
          <div className="flex items-center space-x-2">
            <span>效能:</span>
            <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: '80%' }}></div>
            </div>
            <span className="text-green-400">優良</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
