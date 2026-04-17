import React, { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  analyzeImportFile,
  createImportJob,
  formatApiThrownError,
  type AnalyzeImportResponse,
  type ImportColumnMappingEntry,
} from "@/lib/dmsApi";
import { publishTaskCreated } from "@/lib/jobCenter";
import { toast } from "sonner";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  file: File | null;
  countries: string[];
  providers: string[];
  onImported: () => void;
}

const DEFAULT_COUNTRIES = [
  "台灣",
  "中國",
  "香港",
  "新加坡",
  "日本",
  "美國",
  "加拿大",
  "韓國",
  "澳洲",
  "馬來西亞",
  "越南",
  "菲律賓",
];

type MappingMode = "new" | "merge" | "skip";

function entryToMode(e: ImportColumnMappingEntry): MappingMode {
  return e.mode;
}

function mappingEnsuresPhone(m: Record<string, ImportColumnMappingEntry>): boolean {
  for (const v of Object.values(m)) {
    if (v.mode === "merge" && v.targetKey === "phone") return true;
  }
  return false;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  fileName,
  file,
  countries,
  providers,
  onImported,
}) => {
  const safeCountries = useMemo(
    () =>
      Array.from(
        new Set(
          [...(Array.isArray(countries) ? countries : []), ...DEFAULT_COUNTRIES]
            .map((x) => String(x || "").trim())
            .filter(Boolean)
        )
      ),
    [countries]
  );
  const safeProviders = useMemo(() => (Array.isArray(providers) ? providers : []), [providers]);
  const CUSTOM_PROVIDER = "__CUSTOM__";

  type FormState = { country: string; provider: string; customProvider: string };
  const [form, setForm] = useState<FormState>({
    country: safeCountries[0] || "",
    provider: CUSTOM_PROVIDER,
    customProvider: "",
  });

  const isUsingCustomProvider = !form.provider || form.provider === CUSTOM_PROVIDER;
  const fileBaseName = useMemo(() => {
    if (!fileName) return "";
    const lastDot = fileName.lastIndexOf(".");
    return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
  }, [fileName]);

  const [submitting, setSubmitting] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeData, setAnalyzeData] = useState<AnalyzeImportResponse | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, ImportColumnMappingEntry>>({});

  const initMappingFromAnalyze = useCallback((data: AnalyzeImportResponse) => {
    const m: Record<string, ImportColumnMappingEntry> = {};
    for (const c of data.columns) {
      if (c.kind === "new") m[c.header] = { mode: "new" };
      else m[c.header] = { mode: "merge", targetKey: c.suggestedKey };
    }
    setColumnMapping(m);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setForm({
        country: safeCountries[0] || "",
        provider: CUSTOM_PROVIDER,
        customProvider: "",
      });
      setAnalyzeData(null);
      setColumnMapping({});
      setAnalyzeLoading(false);
    }
  }, [isOpen, fileName, safeCountries, safeProviders]);

  const handleAnalyze = async () => {
    if (!file) {
      toast.error("請選擇檔案");
      return;
    }
    setAnalyzeLoading(true);
    setAnalyzeData(null);
    try {
      const data = await analyzeImportFile(file);
      setAnalyzeData(data);
      initMappingFromAnalyze(data);
    } catch (e) {
      toast.error(formatApiThrownError(e, "無法解析檔案"));
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const updateRowMode = (header: string, mode: MappingMode) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      const col = analyzeData?.columns.find((c) => c.header === header);
      const keys = new Set(analyzeData?.mergeTargets.map((t) => t.key) ?? []);
      if (mode === "skip") next[header] = { mode: "skip" };
      else if (mode === "new") next[header] = { mode: "new" };
      else {
        let target = col?.suggestedKey || "name";
        if (!keys.has(target)) target = analyzeData?.mergeTargets[0]?.key || "name";
        next[header] = { mode: "merge", targetKey: target };
      }
      return next;
    });
  };

  const updateMergeTarget = (header: string, targetKey: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [header]: { mode: "merge", targetKey },
    }));
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("請選擇檔案");
      return;
    }
    const providerFinal = isUsingCustomProvider ? form.customProvider || fileBaseName : form.provider;
    if (!form.country?.trim() || !providerFinal?.trim()) {
      toast.error("請選擇國家並填寫提供者");
      return;
    }
    if (!analyzeData) {
      toast.error("請先解析欄位並確認對照後再匯入");
      return;
    }
    if (!mappingEnsuresPhone(columnMapping)) {
      toast.error("必須至少保留一欄「併入」到電話（phone），否則無法匯入");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createImportJob(
        file,
        form.country.trim(),
        providerFinal.trim(),
        columnMapping
      );
      if (result.status === "queued") {
        publishTaskCreated({
          id: result.jobId,
          source: "import",
          status: "queued",
          title: file.name,
          subtitle: `匯入 ${form.country.trim()} / ${providerFinal.trim()}`,
          createdAt: new Date().toISOString(),
          processedRows: 0,
          totalRows: 0,
        });
        toast.success("已建立匯入工作，系統將分段處理");
        onImported();
        onClose();
      } else if (result.status === "completed") {
        toast.success(`匯入成功，新增 ${result.insertedCount} 筆`);
        onImported();
        onClose();
      } else {
        const f = result as {
          primaryReason: string;
          errorRowNumbers: number[];
          errorCount: number;
        };
        toast.error(f.primaryReason || "匯入失敗", { duration: 8000 });
        if (f.errorRowNumbers?.length) {
          toast.message(`問題列號（最多顯示 100 筆）：${f.errorRowNumbers.join(", ")}`);
        }
      }
    } catch (e) {
      toast.error(formatApiThrownError(e, "匯入失敗"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">設定匯入資料</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          請設定國家與提供者；接著解析檔案以對照欄位（可新增動態欄、併入既有欄、或略過）。系統會先自動給建議，但需由您確認後才會真正匯入。檔案須含可辨識之電話欄。
        </p>

        <div className="space-y-4">
          <div className="border rounded-md border-border overflow-hidden">
            <div className="px-3 py-2 bg-muted/50 text-xs font-medium">基本設定</div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">國家</Label>
                  <Select
                    value={form.country || undefined}
                    onValueChange={(v) => setForm((s) => ({ ...s, country: v }))}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {safeCountries.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    請務必正確填寫國家；此欄位會影響後續電話格式驗證與清理判定結果。
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">資料提供者</Label>
                  <Select
                    value={form.provider || undefined}
                    onValueChange={(v) => setForm((s) => ({ ...s, provider: v }))}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="選擇提供者" />
                    </SelectTrigger>
                    <SelectContent>
                      {safeProviders.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                      <SelectItem value={CUSTOM_PROVIDER}>自訂提供者</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    資料提供者會作為本次匯入的來源標記，影響後續資料追蹤、篩選與匯入紀錄辨識；若清單中沒有合適選項，可改用自訂提供者。
                  </p>
                </div>
              </div>

              {isUsingCustomProvider && (
                <div className="grid gap-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">自訂提供者</Label>
                  <Input
                    className="bg-background"
                    value={form.customProvider || fileBaseName}
                    onChange={(e) => setForm((s) => ({ ...s, customProvider: e.target.value }))}
                    placeholder="輸入提供者名稱（預設帶入檔名）"
                  />
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                    <Lightbulb className="w-4 h-4 mr-1" />
                    您已選擇自訂提供者，系統已自動帶入檔案名稱；您可以直接使用或自行修改。
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleAnalyze()}
              disabled={!file || analyzeLoading}
            >
              {analyzeLoading ? "解析中…" : "解析檔案欄位"}
            </Button>
            {!analyzeData && !analyzeLoading && (
              <span className="text-xs text-muted-foreground">匯入前請先解析，以確認欄位對照。</span>
            )}
            {analyzeData && !analyzeLoading && (
              <span className="text-xs text-muted-foreground">
                已載入系統建議，請檢查後再按「確認匯入」。
              </span>
            )}
          </div>

          {analyzeData && (
            <div className="border rounded-md border-border overflow-hidden">
              <div className="px-3 py-2 bg-muted/50 text-xs font-medium">
                欄位對照（{analyzeData.columns.length} 欄）
              </div>
              <div className="px-3 py-2 text-xs text-amber-800 bg-amber-50 border-y border-amber-100">
                系統已依既有欄位、aliases 與內建規則先給建議；您仍可逐欄改成新增、併入或不匯入。
              </div>
              <div className="overflow-x-auto max-h-[min(360px,45vh)]">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr className="text-left">
                      <th className="p-2 whitespace-nowrap">表頭</th>
                      <th className="p-2 whitespace-nowrap">類型</th>
                      <th className="p-2 whitespace-nowrap">動作</th>
                      <th className="p-2 whitespace-nowrap">併入目標</th>
                      <th className="p-2">預覽（首列）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyzeData.columns.map((c) => {
                      const entry = columnMapping[c.header] || { mode: "merge" as const, targetKey: c.suggestedKey };
                      const mode = entryToMode(entry);
                      const sample = analyzeData.samples[0]?.[c.header] ?? "";
                      return (
                        <tr key={c.header} className="border-t border-border align-top">
                          <td className="p-2 font-mono text-[11px] max-w-[140px] break-all">{c.header}</td>
                          <td className="p-2 whitespace-nowrap">
                            {c.kind === "core" ? "核心" : c.kind === "existing" ? "既有" : "新欄位"}
                          </td>
                          <td className="p-2">
                            <Select
                              value={mode}
                              onValueChange={(v) => updateRowMode(c.header, v as MappingMode)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="merge">併入既有欄位</SelectItem>
                                {c.kind === "new" ? (
                                  <SelectItem value="new">新增動態欄位</SelectItem>
                                ) : null}
                                <SelectItem value="skip">不匯入</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2 min-w-[140px]">
                            {mode === "merge" ? (
                              <Select
                                value={entry.mode === "merge" ? entry.targetKey : c.suggestedKey}
                                onValueChange={(v) => updateMergeTarget(c.header, v)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {analyzeData.mergeTargets.map((t) => (
                                    <SelectItem key={t.key} value={t.key}>
                                      {t.key}（{t.name}）
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-2 text-muted-foreground max-w-[200px] truncate" title={sample}>
                            {sample || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button
            onClick={() => void handleImport()}
            className="bg-gray-900 hover:bg-gray-800 text-white"
            disabled={!fileName || !file || submitting || !analyzeData}
          >
            {submitting ? "匯入中…" : "確認對照並匯入"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
