import React, { useEffect, useState } from "react";
import { fetchAuditLogs, type AuditLogItem } from "@/lib/dmsApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const AuditLogsPage: React.FC = () => {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchAuditLogs({ limit: 200, action: action.trim() || undefined });
      setItems(res.items);
      setTotal(res.total);
    } catch {
      toast.error("無法載入稽核紀錄");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="依 action 篩選（例如 customer.merge-duplicates）"
          className="max-w-md"
        />
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          查詢
        </Button>
      </div>
      <div className="text-sm text-gray-500">共 {total} 筆（顯示最新 200 筆）</div>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="px-3 py-2 text-left">時間</th>
              <th className="px-3 py-2 text-left">動作</th>
              <th className="px-3 py-2 text-left">目標</th>
              <th className="px-3 py-2 text-left">摘要</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-3 text-gray-500" colSpan={4}>
                  載入中…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-gray-500" colSpan={4}>
                  尚無紀錄
                </td>
              </tr>
            ) : (
              items.map((row, idx) => (
                <tr key={`${row.at}-${idx}`} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(row.at).toLocaleString()}</td>
                  <td className="px-3 py-2">{row.action}</td>
                  <td className="px-3 py-2">{row.targetType}{row.targetId ? `:${row.targetId}` : ""}</td>
                  <td className="px-3 py-2 text-gray-600">{JSON.stringify(row.detail || {})}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
