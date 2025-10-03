import React, { useEffect, useState } from 'react';
import { fetchFooter, type FooterInfo } from '@/lib/api';

export const Footer: React.FC = () => {
  const [data, setData] = useState<FooterInfo | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetchFooter(ac.signal).then(setData).catch(() => setData(null));
    return () => ac.abort();
  }, []);

  const status = !data ? 'loading' : data.ok ? (data.db ? 'online' : 'db-issue') : 'offline';
  const pill =
    status === 'loading'
      ? { bg: 'bg-gray-50', border: 'border-gray-300', text: 'text-gray-600', dot: 'bg-gray-400', label: '檢查中' }
      : status === 'online'
      ? { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-700', dot: 'bg-green-600', label: '就緒' }
      : status === 'db-issue'
      ? { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700', dot: 'bg-yellow-600', label: '資料庫異常' }
      : { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', dot: 'bg-red-600', label: '離線' };

  const perfPct = Math.round(Math.max(0, Math.min(1, data?.perf ?? 0.8)) * 100);

  return (
    <footer className="bg-gray-50 text-gray-900 border-t border-gray-250 px-6 py-3 select-none">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-4">
          {/* 系统狀態膠囊 */}
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${pill.bg} ${pill.border} ${pill.text}`}>
            <span className={`w-2.5 h-2.5 rounded-full ${pill.dot}`}></span>
            <span>{pill.label}</span>
          </div>

          <span>•</span>

          {/* 應用名稱與版本 */}
          <span>{data?.version ? `EXSELL資料管理系統 ${data.version}` : 'EXSELL資料管理系統'}</span>
        </div>

        <div className="flex items-center space-x-4">
          {/* 使用者 */}
          <span>{data?.user ? `使用者:${data.user}` : '使用者:—'}</span>

          <span>•</span>

          {/* 時間 */}
          <span>{data ? new Date(data.serverTime).toLocaleString() : '—'}</span>

          <span>•</span>

          {/* 效能 */}
          <div className="flex items-center space-x-2">
            <span>效能:</span>
            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${perfPct}%` }}></div>
            </div>
            <span className="text-green-600">{perfPct}%</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
