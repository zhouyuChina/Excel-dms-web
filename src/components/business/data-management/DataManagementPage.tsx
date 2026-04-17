import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, Plus, RotateCcw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Edit2, Trash2, Download, Upload, Settings, Eye, EyeOff, RefreshCw, Split, Link, StickyNote, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { ArrowUpDown } from 'lucide-react';
// import { Badge } from '@/components/ui/badge';
import { filterTagsData, type FilterTag } from '@/data/mockData';
import type { RecordData } from '@/data/mockData';
import {
  fetchCustomersList,
  fetchCustomerQueryContract,
  fetchCustomersMeta,
  fetchFieldDefinitions,
  patchFieldDefinition,
  patchCustomer,
  deleteCustomer,
  bulkDeleteCustomers,
  bulkDeleteCustomersByFilter,
  type CustomerFilterSnapshot,
  type CustomersListResponse,
  IMPORT_QUICK_FILTER_KEY,
  OPEN_MODULE_EVENT,
} from '@/lib/dmsApi';
import { toast } from 'sonner';
import { JOB_EVENT_STATUS_CHANGED } from '@/lib/jobCenter';
import { renderRecordCell } from './recordCell';
import { 
  ExportModal, 
  UpdateDataModal, 
  MergeDuplicatesModal, 
  MergeFieldsModal, 
  AddRemarksModal, 
  CleanInvalidModal,
  ImportModal,
} from './components/modals';

/** 與後端 `customerWhere` 核心欄位一致；不在此集合的篩選欄位會走 attrs JSON，大表上通常較慢 */
const CORE_FILTER_FIELD_KEYS = new Set([
  "cuid",
  "country",
  "provider",
  "phone",
  "name",
  "englishName",
  "age",
  "birthDate",
  "position",
  "salary",
  "email",
  "department",
  "importRecord",
  "exportRecord",
  "recipient",
  "isError",
]);

const INLINE_EDIT_KEYS: (keyof RecordData)[] = [
  "name",
  "englishName",
  "age",
  "birthDate",
  "position",
  "salary",
  "email",
  "department",
  "provider",
  "recipient",
  "isError",
  "importRecord",
  "exportRecord",
  "attrs",
];

function buildInlinePatch(original: RecordData, draft: RecordData): Partial<RecordData> {
  const patch: Partial<RecordData> = {};
  for (const k of INLINE_EDIT_KEYS) {
    if (draft[k] !== original[k]) {
      (patch as Record<keyof RecordData, unknown>)[k] = draft[k];
    }
  }
  return patch;
}

// interface RecordData {
//   cuid: string;
//   country: string;
//   provider: string;
//   phone: string;
//   name: string;
//   englishName: string;
//   age: number;
//   birthDate: string;
//   position: string;
//   salary: number;
//   email: string;
//   department: string;
//   importRecord: string;
//   exportRecord: string;
//   recipient: string;
//   isError?: boolean;
// }

export const DataManagementPage: React.FC = () => {
  type OperationFeedback = {
    message: string;
    level?: "info" | "success";
  };
  // 状态管理
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectFilteredAll, setSelectFilteredAll] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [filterScrollIndex, setFilterScrollIndex] = useState(0);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [maxOffsetPx, setMaxOffsetPx] = useState(0);
  const [maxScrollIndex, setMaxScrollIndex] = useState(0);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [hasActiveFilters, setHasActiveFilters] = useState(false);
  const [filterConditions, setFilterConditions] = useState<Array<{
    id: string;
    field: string;
    operator: string;
    value: string;
  }>>([]);
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [exportStatusFilter, setExportStatusFilter] = useState<'all' | 'exported' | 'not-exported'>('all');

  const [records, setRecords] = useState<RecordData[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  /** 全表無篩選時後端可能回傳 pg 近似筆數 */
  const [totalApproximate, setTotalApproximate] = useState(false);
  /** 動態欄位等情境下後端略過 COUNT(*) */
  const [totalSkipped, setTotalSkipped] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [debouncedQ, setDebouncedQ] = useState('');
  const [metaCountries, setMetaCountries] = useState<string[]>([]);
  const [metaProviders, setMetaProviders] = useState<string[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [initialFilterBootstrapped, setInitialFilterBootstrapped] = useState(false);
  const [listVersion, setListVersion] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [queryAllowedSorts, setQueryAllowedSorts] = useState<string[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  useEffect(() => {
    const raw = localStorage.getItem(IMPORT_QUICK_FILTER_KEY);
    if (!raw) {
      setInitialFilterBootstrapped(true);
      return;
    }
    localStorage.removeItem(IMPORT_QUICK_FILTER_KEY);
    try {
      const parsed = JSON.parse(raw) as {
        country?: string;
        provider?: string;
        importRecord?: string;
      };
      const nextConditions: Array<{
        id: string;
        field: string;
        operator: string;
        value: string;
      }> = [];
      if (parsed.country) {
        nextConditions.push({
          id: `import-country-${Date.now()}-1`,
          field: "country",
          operator: "等於",
          value: parsed.country,
        });
      }
      if (parsed.provider) {
        nextConditions.push({
          id: `import-provider-${Date.now()}-2`,
          field: "provider",
          operator: "等於",
          value: parsed.provider,
        });
      }
      if (parsed.importRecord) {
        nextConditions.push({
          id: `import-record-${Date.now()}-3`,
          field: "importRecord",
          operator: "包含",
          value: parsed.importRecord,
        });
      }
      if (nextConditions.length) {
        setFilterConditions(nextConditions);
        setCurrentPage(1);
        setCursor(null);
        setNextCursor(null);
        setCursorStack([]);
        setOpFeedback({
          message: "已套用本次匯入的快速篩選條件。",
          level: "info",
        });
      }
    } catch {
      // ignore malformed quick filter
    } finally {
      setInitialFilterBootstrapped(true);
    }
  }, []);
  /** 內聯編輯：目前編輯中的列 cuid 與草稿 */
  const [editingCuid, setEditingCuid] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<RecordData | null>(null);
  const [opFeedback, setOpFeedback] = useState<OperationFeedback | null>(null);
  const [pendingResortCount, setPendingResortCount] = useState(0);
  const [isPaging, setIsPaging] = useState(false);
  
  // 模态框状态
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [updateDataModalOpen, setUpdateDataModalOpen] = useState(false);
  const [mergeDuplicatesModalOpen, setMergeDuplicatesModalOpen] = useState(false);
  const [mergeFieldsModalOpen, setMergeFieldsModalOpen] = useState(false);
  const [addRemarksModalOpen, setAddRemarksModalOpen] = useState(false);
  const [cleanInvalidModalOpen, setCleanInvalidModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalTotalCount, setExportModalTotalCount] = useState<number | null>(null);
  const [exportModalTotalLoading, setExportModalTotalLoading] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedImportFileName, setSelectedImportFileName] = useState<string>('');
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastTagRef = useRef<HTMLDivElement>(null);
  const tagsStripRef = useRef<HTMLDivElement>(null);
  /** 下一頁預取（keyset 相同條件下減少「下一頁」等待） */
  const listPrefetchByKeyRef = useRef<Map<string, CustomersListResponse>>(new Map());
  const listPrefetchAbortRef = useRef<AbortController | null>(null);

  const SCROLL_STEP_PX = 100;

  // 筛选标签 - 控制表格列显示（預設 mock，掛載後以 API 欄位定義覆寫）
  const [filterTags, setFilterTags] = useState<FilterTag[]>(filterTagsData);
  /** 後端欄位定義（含動態欄位）尚未載入完成 */
  const [fieldDefsLoading, setFieldDefsLoading] = useState(true);

  const refreshFieldDefs = async () => {
    const { items } = await fetchFieldDefinitions();
    const mapped = items
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((f) => f.isExportable !== false)
      .map((f) => ({
        id: f.id,
        key: f.key,
        name: f.name,
        color: f.uiColor,
        visible: f.defaultVisible,
      }));
    const hasVisible = mapped.some((x) => x.visible);
    const fallbackKeys = new Set(["cuid", "country", "provider", "phone", "name"]);
    setFilterTags(
      hasVisible
        ? mapped
        : mapped.map((x) => ({ ...x, visible: fallbackKeys.has(x.key) }))
    );
  };

  const loadCustomersMeta = useCallback(async () => {
    if (metaLoading) return;
    setMetaLoading(true);
    try {
      const meta = await fetchCustomersMeta();
      setMetaCountries(meta.countries);
      setMetaProviders(meta.providers);
    } catch {
      // Keep lightweight fallbacks when meta cannot be fetched.
    } finally {
      setMetaLoading(false);
    }
  }, [metaLoading]);

  const openImportModal = () => {
    setImportModalOpen(true);
    if (metaCountries.length === 0 && metaProviders.length === 0) {
      void loadCustomersMeta();
    }
  };

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchTerm.trim()), 320);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [contract] = await Promise.all([
          fetchCustomerQueryContract().catch(() => null),
          refreshFieldDefs(),
        ]);
        if (contract && !cancelled) setQueryAllowedSorts(contract.sorting.allowedFields || []);
        if (cancelled) return;
      } catch {
        if (!cancelled) toast.error('無法載入欄位定義，使用預設欄位');
      } finally {
        if (!cancelled) setFieldDefsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtersKey = JSON.stringify(
    filterConditions.map((c) => ({ field: c.field, operator: c.operator, value: c.value }))
  );

  const hasActiveDynamicAttrsFilter = useMemo(
    () =>
      filterConditions.some(
        (c) => Boolean(String(c.value || "").trim()) && !CORE_FILTER_FIELD_KEYS.has(c.field)
      ),
    [filterConditions]
  );

  const visibleDynamicFieldKeys = useMemo(
    () =>
      filterTags
        .filter((tag) => tag.visible && !CORE_FILTER_FIELD_KEYS.has(tag.key))
        .map((tag) => tag.key)
        .sort(),
    [filterTags]
  );
  const visibleDynamicFieldKeysKey = JSON.stringify(visibleDynamicFieldKeys);

  const shouldPrefetchNextPage = useMemo(
    () =>
      !hasActiveDynamicAttrsFilter &&
      !debouncedQ &&
      filterConditions.length === 0 &&
      visibleDynamicFieldKeys.length === 0,
    [hasActiveDynamicAttrsFilter, debouncedQ, filterConditions.length, visibleDynamicFieldKeys.length]
  );

  const buildListRequestKey = useCallback(
    (cursorVal: string | null) =>
      JSON.stringify({
        fk: filtersKey,
        pageSize,
        q: debouncedQ,
        exportStatus: exportStatusFilter,
        sortField,
        sortDir: sortDirection,
        cursor: cursorVal ?? "",
        visibleDynamicFieldKeys: visibleDynamicFieldKeysKey,
      }),
    [filtersKey, pageSize, debouncedQ, exportStatusFilter, sortField, sortDirection, visibleDynamicFieldKeysKey]
  );

  useEffect(() => {
    listPrefetchByKeyRef.current.clear();
  }, [filtersKey, debouncedQ, exportStatusFilter, pageSize, sortField, sortDirection, visibleDynamicFieldKeysKey]);

  useEffect(() => {
    if (!initialFilterBootstrapped) return;
    let cancelled = false;
    const run = async () => {
      setListLoading(true);
      try {
        const cacheKey = buildListRequestKey(cursor);
        const cached = listPrefetchByKeyRef.current.get(cacheKey);
        if (cached) {
          listPrefetchByKeyRef.current.delete(cacheKey);
          if (cancelled) return;
          setRecords(cached.items);
          setTotalCount(typeof cached.total === "number" ? cached.total : null);
          setTotalApproximate(Boolean(cached.totalApproximate));
          setTotalSkipped(Boolean(cached.totalSkipped));
          setHasMore(Boolean(cached.hasMore));
          setNextCursor(cached.nextCursor ?? null);
          return;
        }

        const res = await fetchCustomersList({
          pageSize,
          q: debouncedQ,
          exportStatus: exportStatusFilter,
          sortField,
          sortDir: sortDirection,
          filters: filterConditions,
          cursor,
          visibleFieldKeys: visibleDynamicFieldKeys,
        });
        if (cancelled) return;
        setRecords(res.items);
        setTotalCount(typeof res.total === "number" ? res.total : null);
        setTotalApproximate(Boolean(res.totalApproximate));
        setTotalSkipped(Boolean(res.totalSkipped));
        setHasMore(Boolean(res.hasMore));
        setNextCursor(res.nextCursor ?? null);
      } catch {
        if (!cancelled) {
          setRecords([]);
          setTotalCount(null);
          setTotalApproximate(false);
          setTotalSkipped(false);
          toast.error("無法載入資料，請確認後端已啟動 (npm run dev:api)");
        }
      } finally {
        if (!cancelled) {
          setListLoading(false);
          setIsPaging(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    buildListRequestKey,
    currentPage,
    pageSize,
    debouncedQ,
    exportStatusFilter,
    sortField,
    sortDirection,
    filterConditions,
    cursor,
    listVersion,
    initialFilterBootstrapped,
    visibleDynamicFieldKeys,
  ]);

  useEffect(() => {
    if (!shouldPrefetchNextPage || listLoading || !nextCursor || !hasMore) return;
    const key = buildListRequestKey(nextCursor);
    if (listPrefetchByKeyRef.current.has(key)) return;
    listPrefetchAbortRef.current?.abort();
    const ac = new AbortController();
    listPrefetchAbortRef.current = ac;
    void fetchCustomersList({
      pageSize,
      q: debouncedQ,
      exportStatus: exportStatusFilter,
      sortField,
      sortDir: sortDirection,
      filters: filterConditions,
      cursor: nextCursor,
      visibleFieldKeys: visibleDynamicFieldKeys,
      signal: ac.signal,
    })
      .then((res) => {
        if (ac.signal.aborted) return;
        listPrefetchByKeyRef.current.set(key, res);
      })
      .catch(() => {});
    return () => {
      ac.abort();
    };
  }, [
    buildListRequestKey,
    listLoading,
    nextCursor,
    hasMore,
    shouldPrefetchNextPage,
    pageSize,
    debouncedQ,
    exportStatusFilter,
    sortField,
    sortDirection,
    filterConditions,
    visibleDynamicFieldKeys,
  ]);

  const exportFilterSnapshot = useMemo((): CustomerFilterSnapshot => {
    return {
      q: debouncedQ,
      exportStatus: exportStatusFilter,
      filters: filterConditions.map(({ field, operator, value }) => ({
        field,
        operator,
        value,
      })),
      sortField,
      sortDir: sortDirection,
      visibleFieldKeys: filterTags.filter((t) => t.visible).map((t) => t.key),
    };
  }, [
    debouncedQ,
    exportStatusFilter,
    filterConditions,
    sortField,
    sortDirection,
    filterTags,
  ]);

  const prevResetSig = useRef<string>("");
  useEffect(() => {
    const sig = `${debouncedQ}|${exportStatusFilter}|${pageSize}|${filtersKey}`;
    if (prevResetSig.current !== "" && prevResetSig.current !== sig) {
      setCurrentPage(1);
      setCursor(null);
      setNextCursor(null);
      setCursorStack([]);
    }
    prevResetSig.current = sig;
  }, [debouncedQ, exportStatusFilter, pageSize, filtersKey]);

  // 检测最后一个标签是否完全可见
  useEffect(() => {
    const checkLastTagVisibility = () => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const containerWidth = container.clientWidth;
        const contentWidth = tagsStripRef.current ? tagsStripRef.current.scrollWidth : 0;
        const maxOffset = Math.max(0, contentWidth - containerWidth);
        const computedMaxIndex = Math.max(0, Math.ceil(maxOffset / SCROLL_STEP_PX));
        setMaxOffsetPx(maxOffset);
        setMaxScrollIndex(computedMaxIndex);
        const currentOffset = filterScrollIndex * SCROLL_STEP_PX;
        setCanScrollRight(currentOffset < maxOffset);
      }
    };

    // 初始检查和滚动后检查
    checkLastTagVisibility();

    // 监听窗口大小变化
    window.addEventListener('resize', checkLastTagVisibility);
    return () => window.removeEventListener('resize', checkLastTagVisibility);
  }, [filterScrollIndex, filterTags]);

  // 允許使用 Shift + 滑鼠滾輪 進行水平滾動（事件監聽版本，易維護且可阻止全域滾動）
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      const moveRight = e.deltaY > 0 || e.deltaX > 0;
      setFilterScrollIndex(prev => (moveRight ? Math.min(maxScrollIndex, prev + 1) : Math.max(0, prev - 1)));
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [maxScrollIndex]);

  // 检测是否有活跃的筛选条件
  useEffect(() => {
    const hasFilters =
      !!searchTerm ||
      exportStatusFilter !== 'all' ||
      filterTags.some((tag) => !tag.visible) ||
      !!sortField ||
      filterConditions.length > 0;
    setHasActiveFilters(hasFilters);
  }, [searchTerm, filterTags, sortField, exportStatusFilter, filterConditions.length]);

  const handleOpenImportFilePicker = () => {
    importFileInputRef.current?.click();
  };

  const handleImportFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setSelectedImportFileName(file.name);
      openImportModal();
    }
  };

  const handleCloseImportModal = () => {
    setImportModalOpen(false);
    setSelectedImportFileName('');
    setImportFile(null);
    if (importFileInputRef.current) {
      importFileInputRef.current.value = '';
    }
  };

  const bumpList = () => {
    setListVersion((v) => v + 1);
    setSelectedItems([]);
  };

  const isExportedRecord = (r: RecordData): boolean => String(r.exportRecord || "").trim() !== "";

  const cancelInlineEdit = () => {
    setEditingCuid(null);
    setEditDraft(null);
  };

  const startInlineEdit = (record: RecordData) => {
    setEditingCuid(record.cuid);
    setEditDraft({ ...record });
  };

  const patchEditDraft = (patch: Partial<RecordData>) => {
    setEditDraft((d) => (d ? { ...d, ...patch } : null));
  };

  const commitInlineEdit = async () => {
    if (!editingCuid || !editDraft) return;
    const original = pageData.find((r) => r.cuid === editingCuid);
    if (!original) {
      cancelInlineEdit();
      return;
    }
    const patch = buildInlinePatch(original, editDraft);
    if (Object.keys(patch).length === 0) {
      toast.message("沒有變更");
      cancelInlineEdit();
      return;
    }
    try {
      await patchCustomer(editingCuid, patch);
      toast.success("已儲存");
      setOpFeedback({
        message: "資料已更新。你可在全部編輯完成後手動套用最新排序。",
        level: "success",
      });
      setPendingResortCount((n) => n + 1);
      setRecords((prev) =>
        prev.map((r) => (r.cuid === editingCuid ? ({ ...r, ...patch } as RecordData) : r))
      );
      cancelInlineEdit();
    } catch {
      toast.error("儲存失敗");
    }
  };

  useEffect(() => {
    setEditingCuid(null);
    setEditDraft(null);
  }, [currentPage]);

  useEffect(() => {
    const onTaskStatusChanged = (event: Event) => {
      const task = (event as CustomEvent<{ source: string; status: string; title?: string }>).detail;
      if (!task) return;
      if (task.status !== "completed") return;
      // 任務完成後自動刷新資料與欄位，避免手動重整。
      setOpFeedback({
        message: `${task.title || "背景任務"} 已完成，列表已同步更新。`,
        level: "info",
      });
      bumpList();
      void refreshFieldDefs();
    };
    window.addEventListener(JOB_EVENT_STATUS_CHANGED, onTaskStatusChanged as EventListener);
    return () => {
      window.removeEventListener(JOB_EVENT_STATUS_CHANGED, onTaskStatusChanged as EventListener);
    };
  }, []);

  // 切換欄位顯示狀態（全站欄位 key）
  const toggleColumnVisibility = (columnKey: string) => {
    const current = filterTags.find((x) => x.key === columnKey);
    if (!current) return;
    const nextVisible = !current.visible;

    // optimistic update
    setFilterTags((prev) =>
      prev.map((tag) => (tag.key === columnKey ? { ...tag, visible: nextVisible } : tag))
    );

    if (current.id) {
      void (async () => {
        try {
          await patchFieldDefinition(current.id!, { defaultVisible: nextVisible });
        } catch {
          // rollback on failure
          setFilterTags((prev) =>
            prev.map((tag) =>
              tag.key === columnKey ? { ...tag, visible: current.visible } : tag
            )
          );
          toast.error("欄位可見性更新失敗，已回復原狀");
        }
      })();
    }
    setHasActiveFilters(true);
  };

  // 添加筛选条件
  const addFilterCondition = () => {
    const newCondition = {
      id: Date.now().toString(),
      field: 'cuid',
      operator: '等於',
      value: ''
    };
    setFilterConditions(prev => [...prev, newCondition]);
  };

  // 删除筛选条件
  const removeFilterCondition = (id: string) => {
    setFilterConditions(prev => prev.filter(condition => condition.id !== id));
  };

  // 更新筛选条件
  const updateFilterCondition = (id: string, field: string, value: string) => {
    setFilterConditions(prev => prev.map(condition =>
      condition.id === id ? { ...condition, [field]: value } : condition
    ));
  };

  const handleBulkDelete = async () => {
    if (!selectFilteredAll && selectedItems.length === 0) return;
    if (selectFilteredAll && totalCount === 0) return;
    const confirmMsg =
      selectFilteredAll && totalCount === null
        ? "確定刪除目前篩選符合的全部資料？（總筆數未即時計算，後端仍會依篩選刪除）"
        : `確定刪除${selectFilteredAll ? "目前篩選全部" : "已選"}的 ${selectFilteredAll ? totalCount : selectedItems.length} 筆？`;
    if (!window.confirm(confirmMsg)) return;
    try {
      const result = selectFilteredAll
        ? await bulkDeleteCustomersByFilter(exportFilterSnapshot)
        : await bulkDeleteCustomers(selectedItems);
      toast.success("已刪除");
      setOpFeedback({
        message: `已刪除 ${result.deleted} 筆資料，列表已重新整理。`,
        level: "success",
      });
      setSelectFilteredAll(false);
      setSelectedItems([]);
      bumpList();
    } catch {
      toast.error("刪除失敗");
    }
  };

  const handleRowDelete = async (record: RecordData) => {
    if (!window.confirm("確定刪除此筆客戶？")) return;
    if (editingCuid === record.cuid) cancelInlineEdit();
    try {
      await deleteCustomer(record.cuid);
      toast.success("已刪除");
      setOpFeedback({
        message: `已刪除 ${record.name || record.cuid}，資料已移出列表。`,
        level: "success",
      });
      bumpList();
    } catch {
      toast.error("刪除失敗");
    }
  };

  // 处理工具菜单选择
  const handleToolMenuSelect = (value: string) => {
    setToolMenuOpen(false);
    switch (value) {
      case 'export':
        void openExportModal();
        break;
      case 'update-data':
        setUpdateDataModalOpen(true);
        break;
      case 'merge-duplicates':
        setMergeDuplicatesModalOpen(true);
        break;
      case 'merge-fields':
        setMergeFieldsModalOpen(true);
        break;
      case 'add-remarks':
        setAddRemarksModalOpen(true);
        break;
      case 'clean-invalid':
        setCleanInvalidModalOpen(true);
        break;
      default:
        break;
    }
  };

  const openExportModal = async () => {
    setExportModalTotalCount(totalCount);
    setExportModalTotalLoading(true);
    setExportModalOpen(true);
    try {
      const res = await fetchCustomersList({
        pageSize: 1,
        q: debouncedQ,
        exportStatus: exportStatusFilter,
        sortField,
        sortDir: sortDirection,
        filters: filterConditions,
        cursor: null,
      });
      setExportModalTotalCount(typeof res.total === "number" ? res.total : null);
    } catch {
      // Keep current known total if count refresh fails.
      setExportModalTotalCount(totalCount);
    } finally {
      setExportModalTotalLoading(false);
    }
  };

  // 重置所有筛选
  const resetFilters = () => {
    setFilterTags(prev => prev.map(tag => ({ ...tag, visible: true })));
    setSearchTerm('');
    setSortField('');
    setSortDirection('asc');
    setFilterConditions([]);
    setHasActiveFilters(false);
  };

  // 处理排序
  const handleSort = (field: string) => {
    if (queryAllowedSorts.length && !queryAllowedSorts.includes(field)) {
      toast.warning("此欄位未納入高效索引排序白名單");
      return;
    }
    if (sortField !== field) {
      // 第一次點該欄位：設定為升冪
      setSortField(field);
      setSortDirection('asc');
      return;
    }
    if (sortDirection === 'asc') {
      // 第二次點同一欄位：改為降冪
      setSortDirection('desc');
      return;
    }
    // 第三次點同一欄位：取消排序（恢復預設順序）
    setSortField('');
    setSortDirection('asc');
  };

  // 获取排序图标
  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      // 未排序狀態：顯示灰色向下箭頭（提示可點擊排序）
      return <ArrowUpDown size={14} className="text-gray-400" />;
    }
    if (sortDirection === 'asc') {
      return <ChevronDown size={14} className="text-gray-600 dark:text-gray-300" />;
    }
    return <ChevronUp size={14} className="text-gray-600 dark:text-gray-300" />;
  };

  // 处理全选
  const handleSelectAll = () => {
    setSelectFilteredAll(false);
    if (selectedItems.length === pageData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(pageData.map(item => item.cuid));
    }
  };

  // 处理单个选择
  const handleSelectItem = (cuid: string) => {
    setSelectFilteredAll(false);
    setSelectedItems(prev =>
      prev.includes(cuid)
        ? prev.filter(id => id !== cuid)
        : [...prev, cuid]
    );
  };

  const pageData = records;
  const totalCountPrefix = totalApproximate ? "約 " : "";
  const totalPages =
    totalCount === null
      ? Math.max(1, currentPage + (hasMore ? 1 : 0))
      : Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeEndRow = (currentPage - 1) * pageSize + pageData.length;
  const bulkToolbarVisible = selectFilteredAll || selectedItems.length > 0;
  const bulkDeleteDisabled =
    (!selectFilteredAll && selectedItems.length === 0) || (selectFilteredAll && totalCount === 0);

  // 处理分页
  const handlePageChange = (page: number) => {
    if (isPaging || listLoading) return;
    if (page === 1) {
      if (currentPage === 1) return;
      setIsPaging(true);
      setCurrentPage(1);
      setCursor(null);
      setNextCursor(null);
      setCursorStack([]);
      return;
    }
    if (page === currentPage + 1 && hasMore) {
      if (!nextCursor) return;
      setIsPaging(true);
      setCursorStack((prev) => [...prev, cursor || ""]);
      setCursor(nextCursor);
      setCurrentPage((p) => p + 1);
      return;
    }
    if (page === currentPage - 1 && currentPage > 1) {
      setIsPaging(true);
      const prevCursor = cursorStack[cursorStack.length - 1] ?? null;
      setCursorStack((prev) => prev.slice(0, -1));
      setCursor(prevCursor || null);
      setCurrentPage((p) => Math.max(1, p - 1));
      return;
    }
    if (page === totalPages) {
      toast.message("目前為 keyset 分頁，暫不支援直接跳到最後一頁，請用下一頁逐步瀏覽。");
    }
  };

  const applyLatestSort = () => {
    setPendingResortCount(0);
    setOpFeedback(null);
    bumpList();
  };

  return (
    <div className="space-y-6">
      {/* 搜索和筛选栏 */}
      <div className="bg-white dark:bg-gray-800 rounded-md shadow-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-* relative">
            <Input
              placeholder="輸入關鍵字搜尋資料..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (e.target.value) setHasActiveFilters(true);
              }}
              className="pl-10 bg-gray-100 border-b border-gray-100"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="flex items-center gap-2" onClick={addFilterCondition}>
              <Plus size={16} />
              新增篩選
            </Button>
            {hasActiveFilters && (
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={resetFilters}
              >
                <RotateCcw size={16} />
                重置
              </Button>
            )}
          </div>
        </div>

        {/* 筛选标签 */}
        <div className="relative mt-4">
          <div className="flex items-center gap-2">
            {/* 左滚动按钮 */}
            <button
              onClick={() => setFilterScrollIndex(Math.max(0, filterScrollIndex - 1))}
              disabled={filterScrollIndex === 0}
              className="flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>

            {/* 标签容器 */}
            <div className="flex-1 overflow-hidden" ref={scrollContainerRef}>
              <div
                ref={tagsStripRef}
                className="flex gap-2 transition-transform duration-300"
                style={{ transform: `translateX(-${Math.min(filterScrollIndex * SCROLL_STEP_PX, maxOffsetPx)}px)` }}
              >
                {filterTags.map((tag, index) => (
                  <div
                    key={index}
                    ref={index === filterTags.length - 1 ? lastTagRef : null}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-colors whitespace-nowrap ${tag.visible
                      ? 'bg-gray-900 dark:bg-gray-200 text-white'
                      : 'bg-gray-200 dark:bg-gray-900 opacity-50'
                      }`}
                    onClick={() => toggleColumnVisibility(tag.key)}
                  >
                    <span className={`w-2 h-2 rounded-full ${tag.color}`}></span>
                     {tag.visible ? (
                      <Eye size={14} className="text-gray-50" />) : (
                      <EyeOff size={14} className="text-muted-foreground" />
                     )}
                    <span>{tag.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 右滚动按钮 */}
            <button
              onClick={() => setFilterScrollIndex(Math.min(maxScrollIndex, filterScrollIndex + 1))}
              disabled={!canScrollRight}
              className="flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {fieldDefsLoading && (
            <p className="text-xs text-muted-foreground mt-2 pl-0.5 leading-relaxed">
              正在載入欄位定義… 動態欄位尚未就緒時，下方標籤列與「新增篩選」欄位選單可能仍為預設；載入完成後會自動更新。
            </p>
          )}
        </div>

        {/* 筛选条件 */}
        {filterConditions.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">   
            <div className="space-y-3">
              {filterConditions.map((condition) => (
                <div key={condition.id} className="flex items-center gap-3">
                  <Select
                    value={condition.field}
                    onValueChange={(value) => updateFilterCondition(condition.id, 'field', value)}
                  >
                    <SelectTrigger className="w-auto min-w-32 px-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {filterTags.map((tag) => (
                        <SelectItem key={tag.key} value={tag.key}>
                          {tag.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={condition.operator}
                    onValueChange={(value) => updateFilterCondition(condition.id, 'operator', value)}
                  >
                    <SelectTrigger className="w-auto min-w-24 px-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="等於">等於</SelectItem>
                      <SelectItem value="不等於">不等於</SelectItem>
                      <SelectItem value="包含">包含</SelectItem>
                      <SelectItem value="不包含">不包含</SelectItem>
                      <SelectItem value="大於">大於</SelectItem>
                      <SelectItem value="小於">小於</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="輸入值"
                    value={condition.value}
                    onChange={(e) => updateFilterCondition(condition.id, 'value', e.target.value)}
                    className="flex-1"
                  />

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFilterCondition(condition.id)}
                    className="h-8 w-8 text-gray-500 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
            {hasActiveDynamicAttrsFilter && (
              <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800 rounded px-3 py-2 mt-3 leading-relaxed">
                動態欄位會查詢 JSON（attrs），資料量很大時通常比一般欄位慢許多。建議先加國別、人事等可縮小範圍的條件；並在資料庫套用專案內{" "}
                <span className="font-mono">server/prisma/perf-indexes.sql</span>{" "}
                中的 attrs GIN 索引。若仍慢，可為常查的單一鍵加 expression index（腳本內有範例註解）。
              </p>
            )}
          </div>
        )}
      </div>

      {/* 數據表格 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden py-2">
        {/* 表格工具列（視覺上與表格一體） */}
        <div className="px-7 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2 bg-white dark:bg-gray-800 relative -mt-1">
          {/* 左側群組：顯示筆數 / 篩選提示 / 批次刪除 */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {listLoading ? (
                <>顯示 {pageData.length} 筆 · 載入中…</>
              ) : totalSkipped ? (
                <>
                  顯示 {pageData.length} 筆（略過總筆數計算以加速；動態欄位條件仍會套用）
                </>
              ) : (
                <>
                  顯示 {pageData.length} 筆（符合 {totalCountPrefix}
                  {totalCount === null ? "—" : totalCount} 筆）
                </>
              )}
            </span>
            {exportStatusFilter !== 'all' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground whitespace-nowrap">
                篩選：{exportStatusFilter === 'exported' ? '已匯出' : '未匯出'}
              </span>
            )}
            {opFeedback && (
              <div className={`rounded border px-2 py-1 text-xs flex items-center gap-2 ${
                opFeedback.level === "success"
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
              }`}>
                <span className="whitespace-nowrap">{opFeedback.message}</span>
                {pendingResortCount > 0 && (
                  <Button variant="outline" size="sm" className="h-6 text-xs" onClick={applyLatestSort}>
                    立即套用排序
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setOpFeedback(null)}
                >
                  關閉
                </Button>
              </div>
            )}
            {bulkToolbarVisible && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {selectFilteredAll
                    ? totalCount === null
                      ? "已選目前篩選全部（筆數未即時計算）"
                      : `已選目前篩選全部 ${totalCount} 筆`
                    : `已選 ${selectedItems.length} 筆`}
                </span>
                {!selectFilteredAll &&
                  pageData.length > 0 &&
                  (totalCount === null ? hasMore : totalCount > pageData.length) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={() => {
                      setSelectFilteredAll(true);
                      setSelectedItems([]);
                    }}
                  >
                    全選目前篩選全部
                  </Button>
                )}
                {selectFilteredAll && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={() => setSelectFilteredAll(false)}
                  >
                    取消全選全部
                  </Button>
                )}
                <Button variant="destructive" size="sm" className="h-7 px-3" onClick={handleBulkDelete} disabled={bulkDeleteDisabled}>
                  <Trash2 size={14} />
                  <span className="ml-1 text-xs">刪除</span>
                </Button>
              </div>
            )}
            {pendingResortCount > 0 && (
              <Button variant="outline" size="sm" className="h-7 px-3 text-xs" onClick={applyLatestSort}>
                套用最新排序（{pendingResortCount}）
              </Button>
            )}
            {totalCount !== null && totalCount >= 1_000_000 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
                命中量級偏大，建議加條件縮小範圍
              </span>
            )}
          </div>

          {/* 右側群組：篩選 / 匯入 / 匯出 / 工具選單 */}
          <div className="flex items-center gap-2">
            <Select value={exportStatusFilter} onValueChange={(v) => setExportStatusFilter(v as any)}>
              <SelectTrigger className="w-auto min-w-20 px-3 h-9 bg-gray-100 border border-gray-100 text-xs select-none">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="exported">已匯出</SelectItem>
                <SelectItem value="not-exported">未匯出</SelectItem>
              </SelectContent>
            </Select>

          <Button variant="outline" className="flex items-center gap-2 text-xs select-none" onClick={handleOpenImportFilePicker}>
            <Download size={16} />
            匯入檔案
          </Button>
          <input
            ref={importFileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImportFileChange}
          />

          <Button 
            variant="outline" 
            className="flex items-center gap-2 text-xs bg-black text-white border-none select-none"
            onClick={() => void openExportModal()}
          >
            <Upload size={16} />
            快速匯出
          </Button>

          <DropdownMenu open={toolMenuOpen} onOpenChange={setToolMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2 text-xs select-none">
                <Settings size={16} />
                工具選單
                <ChevronDown size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-32">
              <DropdownMenuItem onSelect={() => handleToolMenuSelect('update-data')} className="flex items-center gap-2 pl-3 ">
                <RefreshCw size={14} />
                更新資料
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleToolMenuSelect('merge-duplicates')} className="flex items-center gap-2 pl-3">
                <Split size={14} />
                合併重複
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleToolMenuSelect('merge-fields')} className="flex items-center gap-2 pl-3">
                <Link size={14} />
                合併欄位
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleToolMenuSelect('add-remarks')} className="flex items-center gap-2 pl-3">
                <StickyNote size={14} />
                添加備註
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleToolMenuSelect('clean-invalid')} className="flex items-center gap-2 pl-3">
                <Settings size={14} />
                清理無效
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap">
            <thead className="bg-gray-100 dark:bg-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300">
              <tr>
                <th className="px-4 py-3 text-center w-10">
                <div className="inline-flex items-center justify-center gap-2">
                <span className="w-2 h-2 opacity-0" />
                  <input
                    type="checkbox"
                    checked={selectFilteredAll || (pageData.length > 0 && selectedItems.length === pageData.length)}
                    onChange={handleSelectAll}
                    className="rounded border-border accent-black focus:ring-ring"
                  />
                </div>
                </th>
                {filterTags.filter(tag => tag.visible).map((tag, index) => (
                  <th key={index} className="px-4 py-3 text-center">
                    <div
                      className="flex items-center justify-center gap-1 cursor-pointer hover:text-gray-800 dark:hover:text-gray-100 transition-colors"
                      onClick={() => handleSort(tag.key)}
                    >
                      <span>{tag.name}</span>
                      {getSortIcon(tag.key)}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center sticky right-0 bg-gray-100 dark:bg-gray-700 select-none z-10">操作</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((record) => {
                const isRowEditing = editingCuid === record.cuid;
                const cellEdit =
                  isRowEditing && editDraft
                    ? { draft: editDraft, onPatch: patchEditDraft }
                    : undefined;
                return (
                <tr
                  key={record.cuid}
                  className={`text-center border-t border-gray-200 dark:border-gray-700 text-[13px] font-normal text-gray-700 dark:text-gray-300 ${
                    isRowEditing
                      ? "bg-gray-100/90 dark:bg-gray-800/70 ring-1 ring-inset ring-gray-400/70 dark:ring-gray-500/70"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                 <td className="px-4 py-3 text-center align-middle">
                  <div className="inline-flex items-center justify-center gap-2">
                     <span
                       className={`w-2 h-2 shrink-0 rounded-full ${
                         isRowEditing && editDraft
                           ? isExportedRecord(editDraft)
                           : isExportedRecord(record)
                             ? 'bg-red-500'
                             : 'opacity-0'
                       }`}
                     />
                    <input
                      type="checkbox"
                      checked={selectFilteredAll || selectedItems.includes(record.cuid)}
                      onChange={() => handleSelectItem(record.cuid)}
                      disabled={isRowEditing || selectFilteredAll}
                      className="rounded border-border accent-black focus:ring-ring disabled:opacity-40"
                      />
                   </div>
                  </td>
                  {filterTags.filter(tag => tag.visible).map((tag, index) => (
                    <td key={index} className="px-4 py-3 whitespace-nowrap align-middle">
                      {renderRecordCell(record, tag.key, cellEdit)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right sticky right-0 bg-inherit z-10 align-middle">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {isRowEditing && editDraft ? (
                        <>
                          <label className="flex items-center gap-1 text-xs text-gray-600 mr-1 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={isExportedRecord(editDraft)}
                              onChange={(e) =>
                                patchEditDraft({
                                  exportRecord: e.target.checked ? new Date().toISOString().slice(0, 10) : "",
                                })
                              }
                              className="rounded border-border accent-black"
                            />
                            已匯出
                          </label>
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 px-2 gap-1"
                            type="button"
                            onClick={() => void commitInlineEdit()}
                          >
                            <Check size={14} />
                            儲存
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2"
                            type="button"
                            onClick={cancelInlineEdit}
                          >
                            取消
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            type="button"
                            onClick={() => startInlineEdit(record)}
                            title="編輯"
                          >
                            <Edit2 size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            type="button"
                            onClick={() => void handleRowDelete(record)}
                            title="刪除"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* 表格底部工具列（分頁控制，與表格一體） */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between bg-white dark:bg-gray-800">
          <div className="flex items-center space-x-2 mt-2">
            <span className="text-xs text-gray-500">每頁顯示</span>
            <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
              <SelectTrigger className="w-auto min-w-20 px-3 h-7 bg-gray-100 border border-gray-100 text-xs select-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top" sideOffset={4} className="min-w-16 select-none">
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-gray-500">筆</span>
          </div>

          <div className="text-xs text-gray-500 mt-2">
            顯示第 {(currentPage - 1) * pageSize + 1}-{rangeEndRow} 筆
            {totalCount === null
              ? "，總筆數未即時計算（動態欄位等重條件）"
              : `，共 ${totalCountPrefix}${totalCount} 筆資料`}
          </div>

          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1 || isPaging || listLoading}
              className="h-8 w-8 p-0 mt-2"
            >
              <ChevronLeft size={16} />
              <ChevronLeft size={16} className="-ml-2" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || isPaging || listLoading}
              className="h-8 w-8 p-0 mt-2"
            >
              <ChevronLeft size={16} />
            </Button>

            <span className="px-3 py-1 text-xs text-gray-500 mt-2">
              第 {currentPage} 頁
              {totalCount === null ? "（總頁數未計算）" : `，共 ${totalPages} 頁`}
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!hasMore || isPaging || listLoading}
              className="h-8 w-8 p-0 mt-2"
            >
              <ChevronRight size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange(totalPages)}
              disabled={
                totalCount === null || currentPage === totalPages || isPaging || listLoading
              }
              className="h-8 w-8 p-0 mt-2"
            >
              <ChevronRight size={16} />
              <ChevronRight size={16} className="-ml-2" />
            </Button>
          </div>
        </div>
      </div>

      {/* 模态框组件 */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        totalCount={exportModalTotalCount}
        totalLoading={exportModalTotalLoading}
        filterSnapshot={exportFilterSnapshot}
        onExported={bumpList}
      />
      <UpdateDataModal 
        isOpen={updateDataModalOpen} 
        onClose={() => setUpdateDataModalOpen(false)}
        onUpdated={() => {
          bumpList();
          void refreshFieldDefs();
        }}
      />
      <MergeDuplicatesModal 
        isOpen={mergeDuplicatesModalOpen} 
        onClose={() => setMergeDuplicatesModalOpen(false)}
        onMerged={() => {
          bumpList();
          void refreshFieldDefs();
        }}
      />
      <MergeFieldsModal 
        isOpen={mergeFieldsModalOpen} 
        onClose={() => setMergeFieldsModalOpen(false)}
        onMerged={() => {
          bumpList();
          void refreshFieldDefs();
        }}
      />
      <AddRemarksModal 
        isOpen={addRemarksModalOpen} 
        onClose={() => setAddRemarksModalOpen(false)}
        selectedCuids={selectedItems}
        filteredCount={totalCount}
        filterSnapshot={exportFilterSnapshot}
        onAdded={() => {
          bumpList();
          void refreshFieldDefs();
        }}
      />
      <CleanInvalidModal 
        isOpen={cleanInvalidModalOpen} 
        onClose={() => setCleanInvalidModalOpen(false)}
        selectedCuids={selectedItems}
        filteredCount={totalCount}
        filterSnapshot={exportFilterSnapshot}
        onCleaned={() => {
          bumpList();
          void refreshFieldDefs();
        }}
        onOpenQuarantine={() => {
          window.dispatchEvent(new CustomEvent(OPEN_MODULE_EVENT, { detail: { module: 'invalid-quarantine' } }));
        }}
      />
      <ImportModal
        isOpen={importModalOpen}
        onClose={handleCloseImportModal}
        fileName={selectedImportFileName}
        file={importFile}
        countries={metaCountries.length ? metaCountries : ["台灣"]}
        providers={metaProviders.length ? metaProviders : ["人事部"]}
        onImported={() => {
          bumpList();
          void (async () => {
            try {
              await refreshFieldDefs();
            } catch {
              /* ignore */
            }
          })();
        }}
      />
    </div>
  );
};
