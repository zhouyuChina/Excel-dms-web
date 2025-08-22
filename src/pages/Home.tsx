import { useState, useRef, useEffect } from "react";
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Upload,
  Download,
  FileText,
  Grid3X3,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Hand,
  Heart,
  BarChart3,
  Eye,
  RotateCcw,
  X,
  RefreshCw,
  Split,
  Link,
  StickyNote,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { recordsData, filterTagsData, type FilterTag } from "@/data/mockData";

const Home: React.FC = () => {
  // 状态管理
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [limitLoad, setLimitLoad] = useState(true);
  const [notificationsExpanded, setNotificationsExpanded] = useState(true);
  const [filterScrollIndex, setFilterScrollIndex] = useState(0);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [hasActiveFilters, setHasActiveFilters] = useState(false);
  const [filterConditions, setFilterConditions] = useState<Array<{
    id: string;
    field: string;
    operator: string;
    value: string;
  }>>([]);
  const [limitNumber, setLimitNumber] = useState<string>('');
  const [samplingMode, setSamplingMode] = useState<string>('順序選取');
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastTagRef = useRef<HTMLDivElement>(null);

  // 筛选标签 - 控制表格列显示
  const [filterTags, setFilterTags] = useState<FilterTag[]>(filterTagsData);

  // 检测最后一个标签是否完全可见
  useEffect(() => {
    const checkLastTagVisibility = () => {
      if (scrollContainerRef.current && lastTagRef.current) {
        const container = scrollContainerRef.current;
        const lastTag = lastTagRef.current;

        const containerRect = container.getBoundingClientRect();
        const lastTagRect = lastTag.getBoundingClientRect();

        // 检查最后一个标签是否完全在容器内，留一点余量
        const isFullyVisible = lastTagRect.right <= containerRect.right - 10;
        setCanScrollRight(!isFullyVisible);
      }
    };

    // 初始检查和滚动后检查
    checkLastTagVisibility();

    // 监听窗口大小变化
    window.addEventListener('resize', checkLastTagVisibility);
    return () => window.removeEventListener('resize', checkLastTagVisibility);
  }, [filterScrollIndex]);

  // 检测是否有活跃的筛选条件
  useEffect(() => {
    const hasFilters = !!searchTerm || filterTags.some(tag => !tag.visible) || !!sortField;
    setHasActiveFilters(hasFilters);
  }, [searchTerm, filterTags, sortField]);

  // 使用引入的模拟数据
  const records = recordsData;

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

  // 处理工具菜单选择
  const handleToolMenuSelect = (value: string) => {
    setToolMenuOpen(false); // 關閉選單
    switch (value) {
      case 'update-data':
        console.log('執行更新資料');
        // 這裡可以添加更新資料的邏輯
        break;
      case 'merge-duplicates':
        console.log('執行合併重複');
        // 這裡可以添加合併重複的邏輯
        break;
      case 'merge-fields':
        console.log('執行合併欄位');
        // 這裡可以添加合併欄位的邏輯
        break;
      case 'add-remarks':
        console.log('執行添加備註');
        // 這裡可以添加添加備註的邏輯
        break;
      case 'clean-invalid':
        console.log('執行清理無效');
        // 這裡可以添加清理無效的邏輯
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
    if (sortField === field) {
      // 如果点击的是当前排序字段，切换排序方向
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // 如果点击的是新字段，设置为升序
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // 获取排序图标
  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ChevronDown size={14} className="text-gray-400" />;
    }
    return sortDirection === 'asc'
      ? <ChevronDown size={14} className="text-blue-600" />
      : <ChevronDown size={14} className="text-blue-600 rotate-180" />;
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
        ? prev.filter(item => item !== cuid)
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
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* 侧边栏 */}
      <aside
        className={`bg-gray-800 text-white transition-all duration-300 ${sidebarCollapsed ? "w-20" : "w-64"}`}
      >
        <div className="p-4 flex items-center justify-between border-b border-gray-700">
          <div className={`${sidebarCollapsed ? "hidden" : "block"}`}>
            <h1 className="font-bold text-lg">資料管理系統</h1>
            <p className="text-sm text-gray-400">企業級資料處理平台</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-gray-700"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <ChevronLeft size={20} className={sidebarCollapsed ? "rotate-180" : ""} />
          </Button>
        </div>

        <nav className="p-4 space-y-1">
          {/* 主要导航 */}
          <div className={`py-2 px-3 rounded-md bg-gray-700 flex items-center gap-2 ${sidebarCollapsed ? "justify-center" : ""}`}>
            <FileText size={16} />
            {!sidebarCollapsed && <span>資料管理</span>}
          </div>

          {[
            { name: "欄位管理", icon: Grid3X3 },
            { name: "資料驗證", icon: CheckCircle },
            { name: "匯出中心", icon: Upload },
            { name: "匯入記錄", icon: Download },
            { name: "備份還原", icon: Heart },
            { name: "統計分析", icon: BarChart3 },
            { name: "文檔中心", icon: FileText },
          ].map((item, index) => (
            <div
              key={index}
              className={`py-2 px-3 rounded-md hover:bg-gray-700 cursor-pointer transition-colors flex items-center gap-2 ${sidebarCollapsed ? "justify-center" : ""}`}
            >
              <item.icon size={16} />
              {!sidebarCollapsed && <span>{item.name}</span>}
            </div>
          ))}



          {/* 通知展示 */}
          <div className={`py-2 mt-6 border-t border-gray-700 ${sidebarCollapsed ? "flex justify-center" : ""}`}>
            {!sidebarCollapsed && (
              <div
                className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors"
                onClick={() => setNotificationsExpanded(!notificationsExpanded)}
              >
                <ChevronDown
                  size={14}
                  className={`transition-transform ${notificationsExpanded ? "rotate-0" : "-rotate-90"}`}
                />
                <span className="text-gray-400">通知展示</span>
              </div>
            )}
          </div>

          {/* 基本通知 */}
          {!sidebarCollapsed && notificationsExpanded && (
            <div className="space-y-2">
              <div className="text-xs text-gray-400 px-3">基本通知</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-3 py-1 rounded hover:bg-gray-700 cursor-pointer">
                  <CheckCircle size={14} className="text-green-500" />
                  <span className="text-sm">成功通知</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded hover:bg-gray-700 cursor-pointer">
                  <AlertTriangle size={14} className="text-yellow-500" />
                  <span className="text-sm">警告通知</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded hover:bg-gray-700 cursor-pointer">
                  <XCircle size={14} className="text-red-500" />
                  <span className="text-sm">錯誤通知</span>
                </div>
              </div>
            </div>
          )}

          {/* 互动通知 */}
          {!sidebarCollapsed && notificationsExpanded && (
            <div className="space-y-2 mt-4">
              <div className="text-xs text-gray-400 px-3">互動通知</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-3 py-1 rounded hover:bg-gray-700 cursor-pointer">
                  <Hand size={14} />
                  <span className="text-sm">帶操作按鈕</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded hover:bg-gray-700 cursor-pointer">
                  <Hand size={14} />
                  <span className="text-sm">可點擊通知</span>
                </div>
              </div>
            </div>
          )}

          {/* 控制功能 */}
          {!sidebarCollapsed && notificationsExpanded && (
            <div className="space-y-2 mt-4">
              <div className="text-xs text-gray-400 px-3">控制功能</div>
              <div className="space-y-2 px-3">
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full text-xs"
                >
                  清除通知
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full text-xs"
                >
                  測試通知
                </Button>
              </div>
              <div className="text-xs text-gray-400 px-3 mt-2">
                功能說明：
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>滑鼠懸停暫停自動消失</li>
                  <li>點擊執行自定義操作</li>
                </ul>
              </div>
            </div>
          )}

          {/* 系统状态 */}
          {!sidebarCollapsed && (
            <div className="mt-6 border-t border-gray-700 pt-4 px-3">
              <div className="text-xs text-gray-400 mb-2">系統狀態</div>
              <div className="space-y-1 text-sm">
                <div>資料行數：1,234</div>
                <div>存儲使用：2.1MB</div>
              </div>
            </div>
          )}
        </nav>
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部导航 */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <h1 className="font-bold text-lg">企業資料管理系統</h1>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <span>Powered by Excel - Enterprise Data Management</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-6">
              {["檔案", "編輯", "檢視", "工具", "說明"].map((item, index) => (
                <button key={index} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                  {item}
                </button>
              ))}
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="success" className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Online
              </Badge>
            </div>
          </div>
        </header>

        {/* 主要内容 */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
          {/* 搜索和筛选栏 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 max-w-md relative">
                <Input
                  placeholder="輸入關鍵字搜尋資料..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (e.target.value) setHasActiveFilters(true);
                  }}
                  className="pl-10"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" className="flex items-center gap-2" onClick={addFilterCondition}>
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
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>

                {/* 标签容器 */}
                <div className="flex-1 overflow-hidden" ref={scrollContainerRef}>
                  <div
                    className="flex gap-2 transition-transform duration-300"
                    style={{ transform: `translateX(-${filterScrollIndex * 100}px)` }}
                  >
                    {filterTags.map((tag, index) => (
                      <div
                        key={index}
                        ref={index === filterTags.length - 1 ? lastTagRef : null}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-sm cursor-pointer transition-colors whitespace-nowrap ${tag.visible
                          ? 'bg-gray-100 dark:bg-gray-700'
                          : 'bg-gray-50 dark:bg-gray-800 opacity-50'
                          }`}
                        onClick={() => toggleColumnVisibility(tag.name)}
                      >
                        <span className={`w-2 h-2 rounded-full ${tag.color}`}></span>
                        <Eye size={14} className="text-gray-500" />
                        <span>{tag.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 右滚动按钮 */}
                <button
                  onClick={() => setFilterScrollIndex(filterScrollIndex + 1)}
                  disabled={!canScrollRight}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* 筛选条件 */}
            {filterConditions.length > 0 && (
              <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">篩選條件</h3>
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
                        <X size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 操作栏 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={limitLoad}
                    onChange={(e) => setLimitLoad(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
                      className="w-32"
                    />
                    <span className="text-sm text-gray-500">抽樣模式</span>
                    <Select value={samplingMode} onValueChange={setSamplingMode}>
                      <SelectTrigger className="w-auto min-w-32 px-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="順序選取">順序選取</SelectItem>
                        <SelectItem value="隨機抽樣">隨機抽樣</SelectItem>
                      </SelectContent>
                    </Select>
                  </>
                )}

                {!limitLoad && <span className="text-sm text-gray-500">顯示{pageSize}筆</span>}
              </div>

              <div className="flex items-center space-x-2">
                <Select>
                  <SelectTrigger className="w-auto min-w-20 px-3">
                    <SelectValue placeholder="全部" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="exported">已匯出</SelectItem>
                    <SelectItem value="not-exported">未匯出</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="secondary" className="flex items-center gap-2">
                  <Download size={16} />
                  匯入檔案
                </Button>

                <Button variant="secondary" className="flex items-center gap-2">
                  <Upload size={16} />
                  快速匯出
                </Button>

                <div className="relative">
                  <Button 
                    variant="outline" 
                    className="flex items-center gap-2"
                    onClick={() => setToolMenuOpen(!toolMenuOpen)}
                  >
                    <Settings size={16} />
                    工具選單
                    <ChevronDown size={14} />
                  </Button>
                  {toolMenuOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 min-w-32">
                    <div className="py-1">
                      <button 
                        onClick={() => handleToolMenuSelect('update-data')}
                        className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 border-b border-gray-200 dark:border-gray-600"
                      >
                        <RefreshCw size={14} />
                        更新資料
                      </button>
                      <button 
                        onClick={() => handleToolMenuSelect('merge-duplicates')}
                        className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <Split size={14} />
                        合併重複
                      </button>
                      <button 
                        onClick={() => handleToolMenuSelect('merge-fields')}
                        className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <Link size={14} />
                        合併欄位
                      </button>
                      <button 
                        onClick={() => handleToolMenuSelect('add-remarks')}
                        className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <StickyNote size={14} />
                        添加備註
                      </button>
                      <button 
                        onClick={() => handleToolMenuSelect('clean-invalid')}
                        className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <Trash2 size={14} />
                        清理無效
                      </button>
                    </div>
                  </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 数据表格 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={pageData.length > 0 && selectedItems.length === pageData.length}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    {filterTags.filter(tag => tag.visible).map((tag, index) => (
                      <th key={index} className="px-4 py-3 text-center">
                        <div
                          className="flex items-center justify-center gap-1 cursor-pointer hover:text-blue-600 transition-colors"
                          onClick={() => handleSort(tag.name)}
                        >
                          <span>{tag.name}</span>
                          {getSortIcon(tag.name)}
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center sticky right-0 bg-gray-100 dark:bg-gray-700 z-10">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((record) => (
                    <tr key={record.cuid} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedItems.includes(record.cuid)}
                          onChange={() => handleSelectItem(record.cuid)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      {filterTags.filter(tag => tag.visible).map((tag, index) => (
                        <td key={index} className="px-4 py-3 whitespace-nowrap">
                          {tag.name === "CUID" && (
                            <div className="flex items-center">
                              {record.isError && (
                                <span className="w-2 h-2 rounded-full bg-red-500 inline-block mr-2"></span>
                              )}
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
          </div>

          {/* 分页控制 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">每頁顯示</span>
              <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number(value))}>
                <SelectTrigger className="w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-500">筆</span>
            </div>

            <div className="text-sm text-gray-500">
              顯示第{(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalRecords)}筆,共{totalRecords}筆資料
            </div>

            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft size={16} />
                <ChevronLeft size={16} className="-ml-2" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft size={16} />
              </Button>

              <span className="px-3 py-1 text-sm">
                第{currentPage}頁,共{totalPages}頁
              </span>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight size={16} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight size={16} />
                <ChevronRight size={16} className="-ml-2" />
              </Button>
            </div>
          </div>
        </main>

        {/* 页脚状态信息 */}
        <footer className="bg-gray-800 text-white px-6 py-3 flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span>就緒</span>
            </div>
            <span>企業資料管理系統 v1.0.0</span>
            <span>資料庫:已連線</span>
          </div>

          <div className="flex items-center space-x-6">
            <span>使用者:管理員</span>
            <span>2025/08/22 上午06:00</span>
            <div className="flex items-center space-x-2">
              <span>效能:</span>
              <span className="text-green-500">優良</span>
              <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: '80%' }}></div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Home;