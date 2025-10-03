import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Plus, RotateCcw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Edit2, Trash2, Download, Upload, Settings, Eye, EyeOff, RefreshCw, Split, Link, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { ArrowUpDown, ChevronsUpDown } from 'lucide-react';
// import { Badge } from '@/components/ui/badge';
import { recordsData, filterTagsData, type FilterTag } from '@/data/mockData';
import { 
  ExportModal, 
  UpdateDataModal, 
  MergeDuplicatesModal, 
  MergeFieldsModal, 
  AddRemarksModal, 
  CleanInvalidModal,
  ImportModal
} from './components/modals';

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
  // 状态管理
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
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
  const [limitLoad, setLimitLoad] = useState(true);
  const [limitNumber, setLimitNumber] = useState<string>('');
  const [samplingMode, setSamplingMode] = useState<string>('順序選取');
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [exportStatusFilter, setExportStatusFilter] = useState<'all' | 'exported' | 'not-exported'>('all');
  
  // 模态框状态
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [updateDataModalOpen, setUpdateDataModalOpen] = useState(false);
  const [mergeDuplicatesModalOpen, setMergeDuplicatesModalOpen] = useState(false);
  const [mergeFieldsModalOpen, setMergeFieldsModalOpen] = useState(false);
  const [addRemarksModalOpen, setAddRemarksModalOpen] = useState(false);
  const [cleanInvalidModalOpen, setCleanInvalidModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedImportFileName, setSelectedImportFileName] = useState<string>('');
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastTagRef = useRef<HTMLDivElement>(null);
  const tagsStripRef = useRef<HTMLDivElement>(null);

  const SCROLL_STEP_PX = 100;

  // 筛选标签 - 控制表格列显示
  const [filterTags, setFilterTags] = useState<FilterTag[]>(filterTagsData);

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
    const hasFilters = !!searchTerm || filterTags.some(tag => !tag.visible) || !!sortField;
    setHasActiveFilters(hasFilters);
  }, [searchTerm, filterTags, sortField]);

  // 使用引入的模拟数据
  const records = recordsData;

  const countries = useMemo(() => Array.from(new Set(records.map(r => r.country))), [records]);
  const providers = useMemo(() => Array.from(new Set(records.map(r => r.provider))), [records]);

  // 依據工具列的「已匯出/未匯出/全部」選擇，計算符合條件的總筆數（不受分頁影響）
  const filteredRecords = useMemo(() => {
    let arr = records;
    if (exportStatusFilter === 'exported') {
      arr = arr.filter(r => !!r.exportRecord);
    } else if (exportStatusFilter === 'not-exported') {
      arr = arr.filter(r => !r.exportRecord);
    }
    return arr;
  }, [records, exportStatusFilter]);

  const handleOpenImportFilePicker = () => {
    importFileInputRef.current?.click();
  };

  const handleImportFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImportFileName(file.name);
      setImportModalOpen(true);
    }
  };

  const handleCloseImportModal = () => {
    setImportModalOpen(false);
    setSelectedImportFileName('');
    if (importFileInputRef.current) {
      importFileInputRef.current.value = '';
    }
  };

  // 切换列显示状态
  const toggleColumnVisibility = (columnName: string) => {
    setFilterTags(prev => prev.map(tag =>
      tag.name === columnName ? { ...tag, visible: !tag.visible } : tag
    ));
    setHasActiveFilters(true);
  };

  // 添加筛选条件
  const addFilterCondition = () => {
    const newCondition = {
      id: Date.now().toString(),
      field: 'CUID',
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

  // 批次刪除（示意：只清空已選清單；實作上可接後端 API）
  const handleBulkDelete = () => {
    if (selectedItems.length === 0) return;
    // 這裡可以放實際刪除流程（含後端請求與成功後重新載入資料）
    setSelectedItems([]);
  };

  // 处理工具菜单选择
  const handleToolMenuSelect = (value: string) => {
    setToolMenuOpen(false);
    switch (value) {
      case 'export':
        setExportModalOpen(true);
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
      return <ChevronDown size={14} className="text-black" />;
    }
    return <ChevronUp size={14} className="text-black" />;
  };

  // 处理全选
  const handleSelectAll = () => {
    if (selectedItems.length === pageData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(pageData.map(item => item.cuid));
    }
  };

  // 处理单个选择
  const handleSelectItem = (cuid: string) => {
    setSelectedItems(prev =>
      prev.includes(cuid)
        ? prev.filter(id => id !== cuid)
        : [...prev, cuid]
    );
  };

  // 排序数据
  const sortedRecords = [...records].sort((a, b) => {
    if (!sortField) return 0;

    let aValue: any, bValue: any;

    switch (sortField) {
      case 'CUID':
        aValue = a.cuid;
        bValue = b.cuid;
        break;
      case '國家':
        aValue = a.country;
        bValue = b.country;
        break;
      case '提供者':
        aValue = a.provider;
        bValue = b.provider;
        break;
      case '電話號碼':
        aValue = a.phone;
        bValue = b.phone;
        break;
      case '姓名':
        aValue = a.name;
        bValue = b.name;
        break;
      case '英文姓名':
        aValue = a.englishName;
        bValue = b.englishName;
        break;
      case '年齡':
        aValue = a.age;
        bValue = b.age;
        break;
      case '出生日期':
        aValue = a.birthDate;
        bValue = b.birthDate;
        break;
      case '職位':
        aValue = a.position;
        bValue = b.position;
        break;
      case '薪資':
        aValue = a.salary;
        bValue = b.salary;
        break;
      case '電子郵件':
        aValue = a.email;
        bValue = b.email;
        break;
      case '部門':
        aValue = a.department;
        bValue = b.department;
        break;
      case '匯入紀錄':
        aValue = a.importRecord;
        bValue = b.importRecord;
        break;
      case '匯出紀錄':
        aValue = a.exportRecord;
        bValue = b.exportRecord;
        break;
      case '接收者':
        aValue = a.recipient;
        bValue = b.recipient;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // 计算分页数据
  const pageData = sortedRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalRecords = records.length;
  const totalPages = Math.ceil(totalRecords / pageSize);

  // 处理分页
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
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
                    onClick={() => toggleColumnVisibility(tag.name)}
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
                        <SelectItem key={tag.name} value={tag.name}>
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
          </div>
        )}
      </div>

      {/* 操作欄：僅保留限制載入筆數 */}
      <div className="bg-white dark:bg-gray-800 rounded-[var(--radius)] border border-gray-200 dark:border-gray-700 shadow-none p-4">
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={limitLoad}
              onChange={(e) => setLimitLoad(e.target.checked)}
              className="rounded border-border accent-primary focus:ring-ring"
            />
            <span className="text-sm">限制載入筆數</span>
          </label>

          {limitLoad && (
            <>
              <span className="text-sm text-gray-500">筆數限制</span>
              <Input
                type="number"
                placeholder="輸入數字"
                value={limitNumber}
                onChange={(e) => setLimitNumber(e.target.value)}
                className="w-32 min-w-20 px-3 h-9 text-xs"
              />
              <span className="text-sm text-gray-500">抽樣模式</span>
              <Select value={samplingMode} onValueChange={setSamplingMode}>
                <SelectTrigger className="w-auto min-w-20 px-3 h-9 bg-gray-100 border border-gray-100 text-xs select-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="順序選取">順序選取</SelectItem>
                  <SelectItem value="隨機抽樣">隨機抽樣</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </div>

      {/* 數據表格 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden py-2">
        {/* 表格工具列（視覺上與表格一體） */}
        <div className="px-7 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2 bg-white dark:bg-gray-800 relative -mt-1">
          {/* 左側群組：顯示筆數 / 篩選提示 / 批次刪除 */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs text-gray-500 whitespace-nowrap">顯示 {pageData.length} 筆（符合 {filteredRecords.length} 筆）</span>
            {exportStatusFilter !== 'all' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground whitespace-nowrap">
                篩選：{exportStatusFilter === 'exported' ? '已匯出' : '未匯出'}
              </span>
            )}
            {selectedItems.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 whitespace-nowrap">已選 {selectedItems.length} 筆</span>
                <Button variant="destructive" size="sm" className="h-7 px-3" onClick={handleBulkDelete}>
                  <Trash2 size={14} />
                  <span className="ml-1 text-xs">刪除</span>
                </Button>
              </div>
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
            onClick={() => setExportModalOpen(true)}
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
            <thead className="bg-gray-100 dark:bg-gray-700 text-sm">
              <tr>
                <th className="px-4 py-3 text-center w-10">
                <div className="inline-flex items-center justify-center gap-2">
                <span className="w-2 h-2 opacity-0" />
                  <input
                    type="checkbox"
                    checked={pageData.length > 0 && selectedItems.length === pageData.length}
                    onChange={handleSelectAll}
                    className="rounded border-border accent-primary focus:ring-ring"
                  />
                </div>
                </th>
                {filterTags.filter(tag => tag.visible).map((tag, index) => (
                  <th key={index} className="px-4 py-3 text-center">
                    <div
                      className="flex items-center justify-center gap-1 cursor-pointer hover:text-black transition-colors"
                      onClick={() => handleSort(tag.name)}
                    >
                      <span>{tag.name}</span>
                      {getSortIcon(tag.name)}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center sticky right-0 bg-gray-100 dark:bg-gray-700 select-none z-10">操作</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((record) => (
                <tr key={record.cuid} className="text-center border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                 <td className="px-4 py-3 text-center">
                  <div className="inline-flex items-center justify-center gap-2">
                     <span
                       className={`w-2 h-2 rounded-full ${record.isError ? 'bg-red-500' : 'opacity-0'}`}
                     />
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(record.cuid)}
                      onChange={() => handleSelectItem(record.cuid)}
                      className="rounded border-border accent-primary focus:ring-ring"
                      />
                   </div>
                  </td>
                  {filterTags.filter(tag => tag.visible).map((tag, index) => (
                    <td key={index} className="px-4 py-3 whitespace-nowrap">
                      {tag.name === "CUID" && (
                        <div className="flex items-center justify-center">
                          {record.cuid}
                        </div>
                      )}
                      {tag.name === "國家" && record.country}
                      {tag.name === "提供者" && record.provider}
                      {tag.name === "電話號碼" && record.phone}
                      {tag.name === "姓名" && record.name}
                      {tag.name === "英文姓名" && record.englishName}
                      {tag.name === "年齡" && record.age}
                      {tag.name === "出生日期" && record.birthDate}
                      {tag.name === "職位" && record.position}
                      {tag.name === "薪資" && record.salary.toLocaleString()}
                      {tag.name === "電子郵件" && record.email}
                      {tag.name === "部門" && record.department}
                      {tag.name === "匯入紀錄" && record.importRecord}
                      {tag.name === "匯出紀錄" && record.exportRecord}
                      {tag.name === "接收者" && record.recipient}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right sticky right-0 bg-white dark:bg-gray-800 z-10">
                    <div className="flex items-center justify-end space-x-2">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Edit2 size={16} />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
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
            顯示第 {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalRecords)} 筆 , 共 {totalRecords} 筆資料
          </div>

          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0 mt-2"
            >
              <ChevronLeft size={16} />
              <ChevronLeft size={16} className="-ml-2" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0 mt-2"
            >
              <ChevronLeft size={16} />
            </Button>

            <span className="px-3 py-1 text-xs text-gray-500 mt-2">
              第 {currentPage} 頁 , 共 {totalPages} 頁
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0 mt-2"
            >
              <ChevronRight size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
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
      />
      <UpdateDataModal 
        isOpen={updateDataModalOpen} 
        onClose={() => setUpdateDataModalOpen(false)} 
      />
      <MergeDuplicatesModal 
        isOpen={mergeDuplicatesModalOpen} 
        onClose={() => setMergeDuplicatesModalOpen(false)} 
      />
      <MergeFieldsModal 
        isOpen={mergeFieldsModalOpen} 
        onClose={() => setMergeFieldsModalOpen(false)} 
      />
      <AddRemarksModal 
        isOpen={addRemarksModalOpen} 
        onClose={() => setAddRemarksModalOpen(false)} 
      />
      <CleanInvalidModal 
        isOpen={cleanInvalidModalOpen} 
        onClose={() => setCleanInvalidModalOpen(false)} 
      />
      <ImportModal
        isOpen={importModalOpen}
        onClose={handleCloseImportModal}
        fileName={selectedImportFileName}
        countries={countries}
        providers={providers}
      />
    </div>
  );
};
