import { useEffect, useState } from "react";

interface RecordItem {
  id: number;
  cuid: string;
  provider?: string;
  phone?: string;
  createdAt?: string;
}

export default function Records() {
  const [data, setData] = useState<RecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    const skip = (page - 1) * pageSize;
    fetch(`/api/records?skip=${skip}&take=${pageSize}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` }
    })
      .then((r) => r.json())
      .then((res) => {
        setData(res.items || []);
        setTotal(res.total || 0);
      });
  }, [page]);

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">CUID</th>
              <th className="px-3 py-2 text-left">Provider</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.id}</td>
                <td className="px-3 py-2">{r.cuid}</td>
                <td className="px-3 py-2">{r.provider || "-"}</td>
                <td className="px-3 py-2">{r.phone || "-"}</td>
                <td className="px-3 py-2">{r.createdAt || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          className="border rounded-md px-3 py-1 disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          上一页
        </button>
        <span>{page}</span>
        <button
          className="border rounded-md px-3 py-1 disabled:opacity-50"
          disabled={page * pageSize >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
