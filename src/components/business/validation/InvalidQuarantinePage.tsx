import React from "react";
import { Button } from "@/components/ui/button";
import {
  deleteQuarantine,
  deleteQuarantineByFilter,
  fetchQuarantineList,
  patchCustomer,
  releaseQuarantine,
  releaseQuarantineByFilter,
} from "@/lib/dmsApi";
import { toast } from "sonner";

const REASON_LABELS: Record<string, string> = {
  phone_empty: "電話空白",
  email_invalid: "Email 格式錯誤",
  phone_extra_1: "電話多 1 碼",
  phone_extra_2: "電話多 2 碼以上",
  phone_short_1: "電話少 1 碼",
  phone_short_2: "電話少 2 碼以上",
  country_phone_mismatch: "電話與國別不符",
};

type Row = {
  cuid: string;
  country: string;
  provider: string;
  name: string;
  phone: string;
  email: string;
  reasons: string[];
  quarantinedAt: string;
};

export const InvalidQuarantinePage: React.FC = () => {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [savingCuid, setSavingCuid] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [reasonFilter, setReasonFilter] = React.useState<string>("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [total, setTotal] = React.useState(0);
  const hasLoadedOnceRef = React.useRef(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchQuarantineList({
        page,
        pageSize,
        reason: reasonFilter === "all" ? undefined : reasonFilter,
      });
      setRows(result.items);
      setTotal(result.total || 0);
      setSelected([]);
      hasLoadedOnceRef.current = true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "載入隔離資料失敗");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, reasonFilter]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const allReasons = React.useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) row.reasons.forEach((r) => set.add(r));
    return ["all", ...Array.from(set)];
  }, [rows]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const toggleSelected = (cuid: string) => {
    setSelected((prev) => (prev.includes(cuid) ? prev.filter((x) => x !== cuid) : [...prev, cuid]));
  };

  const handleSave = async (row: Row) => {
    try {
      setSavingCuid(row.cuid);
      await patchCustomer(row.cuid, {
        phone: row.phone,
        email: row.email,
        provider: row.provider,
      });
      toast.success("已儲存");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "儲存失敗");
    } finally {
      setSavingCuid(null);
    }
  };

  const handleRelease = async () => {
    if (!selected.length) return;
    try {
      const result = await releaseQuarantine(selected);
      toast.success(`已放回 ${result.released} 筆`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "放回失敗");
    }
  };

  const handleDelete = async () => {
    if (!selected.length) return;
    const ok = window.confirm(`確認永久刪除 ${selected.length} 筆隔離資料？`);
    if (!ok) return;
    try {
      const result = await deleteQuarantine(selected);
      toast.success(`已刪除 ${result.deleted} 筆`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "刪除失敗");
    }
  };

  const handleDeleteByFilter = async () => {
    const reasonText = reasonFilter === "all" ? "全部原因" : REASON_LABELS[reasonFilter] || reasonFilter;
    const ok = window.confirm(`確認刪除「${reasonText}」目前篩選的所有隔離資料？`);
    if (!ok) return;
    try {
      const result = await deleteQuarantineByFilter({
        reason: reasonFilter === "all" ? "" : reasonFilter,
        includeLegacy: false,
      });
      toast.success(`已刪除 ${result.deleted} 筆（依篩選）`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "批次刪除失敗");
    }
  };

  const handleReleaseByFilter = async () => {
    const reasonText = reasonFilter === "all" ? "全部原因" : REASON_LABELS[reasonFilter] || reasonFilter;
    const ok = window.confirm(`確認放回「${reasonText}」目前篩選的所有隔離資料？`);
    if (!ok) return;
    try {
      const result = await releaseQuarantineByFilter({
        reason: reasonFilter === "all" ? "" : reasonFilter,
        includeLegacy: false,
      });
      toast.success(`已放回 ${result.released} 筆（依篩選）`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "批次放回失敗");
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">隔離審核</h2>
          <p className="text-xs text-gray-500">集中預覽、修正與放回被判定為無效的資料</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-9 border rounded px-2 text-xs"
            value={reasonFilter}
            onChange={(e) => {
              setReasonFilter(e.target.value);
              setPage(1);
            }}
          >
            {allReasons.map((r) => (
              <option key={r} value={r}>
                {r === "all" ? "全部原因" : REASON_LABELS[r] || r}
              </option>
            ))}
          </select>
          <select
            className="h-9 border rounded px-2 text-xs"
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value="20">每頁 20</option>
            <option value="50">每頁 50</option>
            <option value="100">每頁 100</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            {loading ? "載入中…" : "重新整理"}
          </Button>
          <Button size="sm" onClick={() => void handleRelease()} disabled={!selected.length}>
            放回
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleReleaseByFilter()}>
            放回目前篩選全部
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void handleDelete()} disabled={!selected.length}>
            永久刪除
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void handleDeleteByFilter()}>
            刪除目前篩選全部
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2 w-10">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selected.length === rows.length}
                  onChange={(e) => setSelected(e.target.checked ? rows.map((x) => x.cuid) : [])}
                />
              </th>
              <th className="px-3 py-2 text-left">姓名</th>
              <th className="px-3 py-2 text-left">國家</th>
              <th className="px-3 py-2 text-left">電話</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">原因</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && !hasLoadedOnceRef.current ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  載入中…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  目前沒有隔離資料
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={row.cuid} className={idx % 2 ? "bg-white" : "bg-gray-50/40"}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(row.cuid)}
                      onChange={() => toggleSelected(row.cuid)}
                    />
                  </td>
                  <td className="px-3 py-2">{row.name || "-"}</td>
                  <td className="px-3 py-2">{row.country || "-"}</td>
                  <td className="px-3 py-2">
                    <input
                      className="h-8 w-44 border rounded px-2"
                      value={row.phone || ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x) => (x.cuid === row.cuid ? { ...x, phone: e.target.value } : x))
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="h-8 w-52 border rounded px-2"
                      value={row.email || ""}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((x) => (x.cuid === row.cuid ? { ...x, email: e.target.value } : x))
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    {(row.reasons || []).map((x) => REASON_LABELS[x] || x).join("、") || "-"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleSave(row)}
                      disabled={savingCuid === row.cuid}
                    >
                      {savingCuid === row.cuid ? "儲存中…" : "儲存"}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-gray-500">
          共 {total} 筆，第 {page}/{pageCount} 頁
        </span>
        <Button size="sm" variant="outline" onClick={() => setPage(1)} disabled={page <= 1}>
          {'<<'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
          {'<'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount}>
          {'>'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPage(pageCount)} disabled={page >= pageCount}>
          {'>>'}
        </Button>
      </div>
    </div>
  );
};

