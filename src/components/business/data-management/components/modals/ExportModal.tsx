import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createExportJob, formatApiThrownError, type CustomerFilterSnapshot } from "@/lib/dmsApi";
import { publishTaskCreated } from "@/lib/jobCenter";
import { toast } from "sonner";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** null：後端未回傳精確筆數（例如動態欄位篩選），匯出任務仍會處理符合條件之全部資料 */
  totalCount: number | null;
  /** 正在向後端重新取得篩選命中總筆數時為 true */
  totalLoading?: boolean;
  filterSnapshot: CustomerFilterSnapshot;
  onExported: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  totalCount,
  totalLoading = false,
  filterSnapshot,
  onExported,
}) => {
  const [recipient, setRecipient] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    const r = recipient.trim();
    if (!r) {
      toast.error("請填寫接收者");
      return;
    }
    setLoading(true);
    try {
      const result = await createExportJob({
        filterSnapshot,
        recipient: r,
        remarks: remarks.trim(),
      });
      if (result.status === "queued" || result.status === "processing") {
        publishTaskCreated({
          id: result.jobId,
          source: "export",
          status: result.status,
          title: `匯出 CSV：${r}`,
          subtitle: remarks.trim() || "依目前篩選結果匯出",
          createdAt: new Date().toISOString(),
          processedRows: 0,
          totalRows: Math.max(0, totalCount ?? 0),
          queuePosition: Number(result.queuePosition ?? 0),
          estimatedWaitSec: Number(result.estimatedWaitSec ?? 0),
        });
      }
      if (result.deduped) {
        toast.success("已使用短時間內相同匯出任務，避免重複提交");
      } else {
        toast.success("已建立匯出任務，請到任務中心查看進度");
      }
      onExported();
      onClose();
    } catch (e) {
      toast.error(formatApiThrownError(e, "匯出失敗"));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">匯出資料</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            將匯出目前篩選下
            {totalLoading ? (
              <>
                共 <strong>…</strong> 筆（CSV）
                <span className="text-xs text-gray-500">（計算筆數中）</span>
              </>
            ) : totalCount === null ? (
              <>
                <strong className="text-amber-700">符合條件之全部資料</strong>（CSV）
                <span className="text-xs text-gray-500 block mt-1">
                  總筆數未即時計算（例如動態欄位篩選）；匯出任務仍會依篩選匯出。
                </span>
              </>
            ) : (
              <>
                共 <strong>{totalCount.toLocaleString()}</strong> 筆（CSV）
              </>
            )}
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              接收者 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="mt-1"
              placeholder="請輸入接收者"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">備註</Label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none"
              rows={3}
              placeholder="選填:匯出說明或備註"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            取消
          </Button>
          <Button
            onClick={() => void handleExport()}
            disabled={loading || totalLoading || (totalCount !== null && totalCount === 0)}
            className="bg-gray-900 hover:bg-gray-800 text-white"
          >
            {loading ? "匯出中…" : "確定匯出"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
