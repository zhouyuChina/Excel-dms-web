import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Download, RotateCcw, X } from 'lucide-react';
import { useHealth } from '@/hooks/useHealth';
import { toast } from 'sonner';
import {
  JOB_EVENT_CREATED,
  fetchHeaderTasks,
  publishTaskStatusChanged,
  retryTaskIfImport,
  subscribeUnifiedTasks,
  type UnifiedTaskItem,
} from '@/lib/jobCenter';
import {
  exportDownloadUrl,
  fetchJobResult,
  formatApiThrownError,
  jobResultFileDownloadUrl,
} from '@/lib/dmsApi';

interface HeaderProps {
  title: string;
  onOpenTaskCenter?: () => void;
  onOpenModule?: (module: string) => void;
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

const DISMISSED_TASKS_KEY = "dms:header-dismissed-tasks:v1";

function readDismissedTaskKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DISMISSED_TASKS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x) => String(x || "")).filter(Boolean);
  } catch {
    return [];
  }
}

function humanizeTaskSubtitle(subtitle: string): string {
  const raw = String(subtitle || "").trim();
  if (!raw) return "-";
  if (raw === "api_restarted_mark_failed") return "服務重啟中斷，任務已停止";
  if (raw === "worker_restarted_mark_failed") return "背景服務重啟中斷，任務已停止";
  if (raw === "worker 執行失敗") return "背景執行失敗，請稍後重試";
  if (raw === "清理檢查中") return "正在檢查資料有效性";
  if (raw.startsWith("掃描中")) return raw.replace("掃描中", "掃描資料中");
  if (raw.startsWith("隔離中")) return raw.replace("隔離中", "正在移入隔離區");
  if (raw.startsWith("刪除中")) return raw.replace("刪除中", "正在刪除");
  return raw;
}

function humanizeFieldPromotionState(state?: UnifiedTaskItem["state"]): string {
  if (state === "rules-confirmed") return "規則已確認，準備產生升級計畫";
  if (state === "pending-maintenance") return "升級計畫已產生，待維護套用";
  if (state === "scheduled-on-restart") return "已排入下次重啟套用";
  if (state === "applying") return "固定欄位升級進行中";
  if (state === "applied") return "固定欄位升級已套用";
  if (state === "failed") return "欄位升級任務失敗";
  return "待確認欄位規則";
}

export const Header: React.FC<HeaderProps> = ({ title, onOpenTaskCenter, onOpenModule }) => {
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
  const [taskOpen, setTaskOpen] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasks, setTasks] = useState<UnifiedTaskItem[]>([]);
  const [dismissedTaskKeys, setDismissedTaskKeys] = useState<string[]>(() => readDismissedTaskKeys());
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);
  const [downloadingTaskId, setDownloadingTaskId] = useState<string | null>(null);
  const prevStatusRef = useRef<Record<string, UnifiedTaskItem["status"]>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // 健康檢查狀態（使用共用 hook）
  const health = useHealth(0);

  const loadTasks = useCallback(async () => {
    try {
      const merged = await fetchHeaderTasks({ inProgressLimit: 20, completedLimit: 5 });
      setTasks(merged);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(DISMISSED_TASKS_KEY, JSON.stringify(dismissedTaskKeys));
    } catch {
      // ignore storage write error
    }
  }, [dismissedTaskKeys]);

  const quickTasks = useMemo(
    () =>
      tasks
        .filter((task) => {
          const key = `${task.source}:${task.id}`;
          // 只允許關閉已完成/失敗，進行中的任務永遠顯示
          if (task.status === "queued" || task.status === "processing") return true;
          return !dismissedTaskKeys.includes(key);
        })
        .slice(0, 8),
    [tasks, dismissedTaskKeys]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpenKey(null);
        setTaskOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    void loadTasks();
    const unsubscribe = subscribeUnifiedTasks(
      { limit: 45, source: "all", status: "all" },
      (streamTasks) => {
        setTasks(streamTasks);
        setTasksLoading(false);
      }
    );
    const handleFocusRefresh = () => {
      void loadTasks();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadTasks();
      }
    };
    const onJobCreated = (event: Event) => {
      const created = (event as CustomEvent<UnifiedTaskItem>).detail;
      if (!created) return;
      setTasks((prev) =>
        [created, ...prev.filter((x) => !(x.id === created.id && x.source === created.source))]
          .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
          .slice(0, 30)
      );
    };
    window.addEventListener(JOB_EVENT_CREATED, onJobCreated as EventListener);
    window.addEventListener("focus", handleFocusRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      unsubscribe();
      window.removeEventListener(JOB_EVENT_CREATED, onJobCreated as EventListener);
      window.removeEventListener("focus", handleFocusRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadTasks]);

  useEffect(() => {
    const nextMap: Record<string, UnifiedTaskItem["status"]> = {};
    for (const task of tasks) {
      const key = `${task.source}:${task.id}`;
      const prev = prevStatusRef.current[key];
      nextMap[key] = task.status;
      if (!prev || prev === task.status) continue;
      if (task.status === "completed") {
        toast.success(`${task.title} 已完成`);
        publishTaskStatusChanged(task);
      } else if (task.status === "failed") {
        toast.error(`${task.title} 失敗`);
        publishTaskStatusChanged(task);
      }
    }
    prevStatusRef.current = nextMap;
  }, [tasks]);

  const inProgressCount = useMemo(
    () => tasks.filter((x) => x.status === 'queued' || x.status === 'processing').length,
    [tasks]
  );

  useEffect(() => {
    const intervalMs = inProgressCount > 0 ? 1500 : 5000;
    const timer = window.setInterval(() => {
      void loadTasks();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [inProgressCount, loadTasks]);

  const openTaskTarget = (task: UnifiedTaskItem) => {
    if (task.source === 'import') {
      onOpenModule?.('import-records');
      return;
    }
    if (task.source === 'export') {
      onOpenModule?.('export-center');
      return;
    }
    onOpenModule?.('field-management');
  };

  const handleRetry = async (task: UnifiedTaskItem) => {
    if (!(task.source === 'import' && task.status === 'failed' && task.canRetry)) return;
    try {
      setRetryingTaskId(task.id);
      await retryTaskIfImport(task);
      toast.success('已送出匯入重試');
      await loadTasks();
    } catch (e) {
      toast.error(formatApiThrownError(e, '重試失敗'));
    } finally {
      setRetryingTaskId(null);
    }
  };

  const handleDownloadExport = async (task: UnifiedTaskItem) => {
    if (!(task.source === "export" && task.status === "completed")) return;
    try {
      setDownloadingTaskId(task.id);
      const result = await fetchJobResult(task.id);
      const files = Array.isArray(result.result?.files)
        ? result.result?.files?.map((x) => String(x.fileName || "").trim()).filter(Boolean)
        : [];
      if (files.length > 0) {
        for (const fileName of files) {
          window.open(jobResultFileDownloadUrl(task.id, fileName), "_blank", "noopener,noreferrer");
        }
        if (files.length > 1) {
          toast.success(`已啟動 ${files.length} 個分檔下載`);
        }
        return;
      }
      const exportId = String(result.result?.exportId || "").trim();
      if (!exportId) {
        toast.error("找不到匯出檔資訊");
        return;
      }
      window.open(exportDownloadUrl(exportId), "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(formatApiThrownError(e, "下載失敗"));
    } finally {
      setDownloadingTaskId(null);
    }
  };

  const dismissTask = (task: UnifiedTaskItem) => {
    if (!(task.status === "completed" || task.status === "failed")) return;
    const key = `${task.source}:${task.id}`;
    setDismissedTaskKeys((prev) => {
      const next = prev.includes(key) ? prev : [...prev, key];
      try {
        window.localStorage.setItem(DISMISSED_TASKS_KEY, JSON.stringify(next));
      } catch {
        // ignore storage write error
      }
      return next;
    });
  };

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
          <div className="relative">
            <button
              className="relative inline-flex items-center gap-2 px-3 py-1 rounded-[var(--radius)] border border-gray-300 bg-white hover:bg-gray-100 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setTaskOpen((v) => !v);
              }}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>任務中心</span>
              {inProgressCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] leading-5 text-center">
                  {inProgressCount}
                </span>
              )}
            </button>
            {taskOpen && (
              <div className="absolute right-0 top-full mt-2 w-[360px] bg-popover text-popover-foreground border border-border rounded-[var(--radius)] shadow-lg z-50">
                <div className="px-3 py-2 border-b border-border text-xs font-medium">
                  任務中心
                </div>
                <div className="max-h-96 overflow-auto">
                  {tasksLoading ? (
                    <div className="px-3 py-4 text-xs text-muted-foreground">載入中…</div>
                  ) : quickTasks.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-muted-foreground">目前沒有可顯示任務</div>
                  ) : (
                    quickTasks.map((task) => {
                      const isFieldPromotion = task.source === "field-promotion";
                      const percent =
                        task.totalRows > 0
                          ? Math.min(100, Math.floor((task.processedRows / task.totalRows) * 100))
                          : task.status === 'completed'
                          ? 100
                          : task.status === 'failed'
                          ? 0
                          : 12;
                      const statusText =
                        task.status === 'queued'
                          ? '排隊中'
                          : task.status === 'processing'
                          ? '進行中'
                          : task.status === 'completed'
                          ? '已完成'
                          : '失敗';
                      const statusColor =
                        task.status === 'completed'
                          ? 'text-green-700'
                          : task.status === 'failed'
                          ? 'text-red-700'
                          : 'text-blue-700';
                      return (
                        <div key={`${task.source}-${task.id}`} className="px-3 py-2 border-b border-border/60">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              className="text-xs font-medium truncate text-left hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTaskOpen(false);
                                openTaskTarget(task);
                              }}
                            >
                              {task.title}
                            </button>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className={`text-[11px] whitespace-nowrap ${statusColor}`}>{statusText}</div>
                              {(task.status === "completed" || task.status === "failed") && (
                                <button
                                  className="inline-flex items-center justify-center w-4 h-4 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                                  title="標記為已看過"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    dismissTask(task);
                                  }}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          {!isFieldPromotion ? (
                            <div className="text-[11px] text-muted-foreground truncate">
                              {humanizeTaskSubtitle(task.subtitle)}
                            </div>
                          ) : null}
                          {isFieldPromotion ? (
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <div className="text-[11px] text-muted-foreground">
                                {task.status === "processing"
                                  ? "欄位升級處理中"
                                  : humanizeFieldPromotionState(task.state)}
                              </div>
                              {task.status !== "completed" ? (
                                <button
                                  className="shrink-0 inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTaskOpen(false);
                                    openTaskTarget(task);
                                  }}
                                >
                                  去處理
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <>
                              <div className="mt-1 w-full h-1.5 rounded bg-gray-200 overflow-hidden">
                                <div className="h-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
                              </div>
                              <div className="mt-1 text-[11px] text-muted-foreground">
                                {task.processedRows}/{task.totalRows || '?'}
                              </div>
                            </>
                          )}
                          {task.status === "queued" &&
                          !isFieldPromotion &&
                          Boolean(task.queuePosition || task.estimatedWaitSec) ? (
                            <div className="text-[11px] text-muted-foreground">
                              排隊#{task.queuePosition || "?"} · 約 {task.estimatedWaitSec || 0}s
                            </div>
                          ) : null}
                          {task.source === 'import' && task.status === 'failed' && task.canRetry && (
                            <button
                              className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-700 hover:underline disabled:opacity-60"
                              disabled={retryingTaskId === task.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleRetry(task);
                              }}
                            >
                              <RotateCcw className="w-3 h-3" />
                              {retryingTaskId === task.id ? '重試中…' : '立即重試'}
                            </button>
                          )}
                          {task.source === 'export' && task.status === 'completed' && (
                            <button
                              className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-700 hover:underline disabled:opacity-60"
                              disabled={downloadingTaskId === task.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDownloadExport(task);
                              }}
                            >
                              <Download className="w-3 h-3" />
                              {downloadingTaskId === task.id ? '取得中…' : '下載'}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                <button
                  className="w-full text-left px-3 py-2 text-xs text-blue-700 hover:bg-accent border-t border-border"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTaskOpen(false);
                    onOpenTaskCenter?.();
                  }}
                >
                  查看全部任務
                </button>
              </div>
            )}
          </div>
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
