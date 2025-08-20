import { useState } from "react";
import { Search, Plus, Filter, AlertCircle, Info, Trash2, Edit2, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

// 定义数据结构
interface RecordData {
  cuid: string;
  country: string;
  provider: string;
  phone: string;
  name: string;
  isError: boolean;
}

const Home: React.FC = () => {
  // 状态管理
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const totalRecords = 6; // 模拟数据总量
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 模拟数据
  const records: RecordData[] = [
    { cuid: "1abc2d3e4f5g6h7i8j", country: "台湾", provider: "人事部", phone: "0912345678", name: "张三", isError: true },
    { cuid: "2def3e4f5g6h7i8j9k", country: "美国", provider: "招聘公司", phone: "0923456789", name: "李四", isError: false },
    { cuid: "3ghi4j5k6l7m8n9o0p", country: "日本", provider: "分公司", phone: "0934567890", name: "王五", isError: true },
    { cuid: "4jkl5m6n7o8p9q0r1s", country: "中国", provider: "猎头公司", phone: "0945678912", name: "谢七", isError: false },
    { cuid: "5rst6u7v8w9x0y1z2a", country: "韩国", provider: "外包商", phone: "0945678901", name: "赵六", isError: false },
    { cuid: "6uvw7x8y9z0a1b2c3d", country: "新加坡", provider: "人才市场", phone: "0956789012", name: "孙八", isError: false },
  ];

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

  // 计算分页数据
  const pageData = records.slice((currentPage - 1) * pageSize, currentPage * pageSize);
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
          <h1 className={`font-bold ${sidebarCollapsed ? "hidden" : "block"}`}>企业资料管理系统</h1>
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
          <div className={`py-2 px-3 rounded-md bg-gray-700 ${sidebarCollapsed ? "flex justify-center" : ""}`}>
            {!sidebarCollapsed && <span>资料管理</span>}
          </div>
          {["档案管理", "资料转档", "汇出中心", "汇入记录", "备份还原", "统计分析"].map((item, index) => (
            <div 
              key={index} 
              className={`py-2 px-3 rounded-md hover:bg-gray-700 cursor-pointer transition-colors ${sidebarCollapsed ? "flex justify-center" : ""}`}
            >
              {!sidebarCollapsed && <span>{item}</span>}
            </div>
          ))}
          
          <div className={`py-2 mt-6 border-t border-gray-700 ${sidebarCollapsed ? "flex justify-center" : ""}`}>
            {!sidebarCollapsed && <span className="text-gray-400">文档中心</span>}
          </div>
          {["通知展示"].map((item, index) => (
            <div 
              key={index} 
              className={`py-2 px-3 rounded-md hover:bg-gray-700 cursor-pointer transition-colors ${sidebarCollapsed ? "flex justify-center" : ""}`}
            >
              {!sidebarCollapsed && <span>{item}</span>}
            </div>
          ))}
        </nav>
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部导航 */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            {["档案", "编辑", "检视", "工具", "说明"].map((item, index) => (
              <button key={index} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                {item}
              </button>
            ))}
          </div>
          <div className="flex items-center space-x-4">
            <div className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800 px-2 py-1 rounded-md text-sm flex items-center">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block mr-1"></span>
              Online
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              管理员
            </div>
          </div>
        </header>

        {/* 主要内容 */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
          {/* 通知面板 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
            <h2 className="font-bold mb-3 text-lg">通知展示</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* <Card className="border-l-4 border-green-500">
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <Info size={20} className="text-green-500 mr-2" />
                    <span className="text-green-700 dark:text-green-300 font-medium">成功通知</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-yellow-500">
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <AlertCircle size={20} className="text-yellow-500 mr-2" />
                    <span className="text-yellow-700 dark:text-yellow-300 font-medium">警告通知</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-red-500">
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <AlertCircle size={20} className="text-red-500 mr-2" />
                    <span className="text-red-700 dark:text-red-300 font-medium">错误通知</span>
                  </div>
                </CardContent>
              </Card> */}
            </div>
          </div>

          {/* 搜索和操作栏 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 max-w-md relative">
                <Input
                  placeholder="输入关键字搜索资料..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="secondary" className="flex items-center gap-2">
                  <Plus size={16} />
                  新增数据
                </Button>
                <Button variant="ghost" size="icon">
                  <Filter size={18} />
                </Button>
              </div>
            </div>
          </div>

          {/* 数据表格 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full">
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
                    <th className="px-4 py-3 text-left">CUID</th>
                    <th className="px-4 py-3 text-left">国家</th>
                    <th className="px-4 py-3 text-left">提供者</th>
                    <th className="px-4 py-3 text-left">电话号码</th>
                    <th className="px-4 py-3 text-left">姓名</th>
                    <th className="px-4 py-3 text-right">操作</th>
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
                      <td className="px-4 py-3 flex items-center">
                        {record.isError && (
                          <span className="w-2 h-2 rounded-full bg-red-500 inline-block mr-2"></span>
                        )}
                        {record.cuid}
                      </td>
                      <td className="px-4 py-3">{record.country}</td>
                      <td className="px-4 py-3">{record.provider}</td>
                      <td className="px-4 py-3">{record.phone}</td>
                      <td className="px-4 py-3">{record.name}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="relative inline-block text-left">
                          <Button variant="ghost" size="sm">
                            操作 <ChevronDown size={16} className="ml-1" />
                          </Button>
                          <div className="hidden absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-10">
                            <div className="py-1">
                              <button className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left flex items-center">
                                <Edit2 size={16} className="mr-2" />
                                编辑
                              </button>
                              <button className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left flex items-center">
                                <Trash2 size={16} className="mr-2" />
                                删除
                              </button>
                            </div>
                          </div>
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
            <div className="text-sm text-gray-500 dark:text-gray-400">
              每页显示
              <select 
                className="mx-2 p-1 border rounded text-sm" 
                value={pageSize} 
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
              </select>
              条，显示{(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalRecords)}，共{totalRecords}条
            </div>
            <div className="flex items-center space-x-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <Button 
                  key={pageNum} 
                  variant={currentPage === pageNum ? "default" : "ghost"} 
                  size="sm"
                  onClick={() => handlePageChange(pageNum)}
                  className="w-8 h-8 p-0"
                >
                  {pageNum}
                </Button>
              ))}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </main>

        {/* 页脚状态信息 */}
        <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between text-sm">
          <div className="text-gray-500 dark:text-gray-400">
            企业资料管理系统 v1.0.0 | 资料：已连线
          </div>
          <div className="flex items-center space-x-6 text-gray-500 dark:text-gray-400">
            <div>资料行数：1,234</div>
            <div>存量使用：2.1MB</div>
            <div>使用者：管理员</div>
            <div>2025/08/21 上午04:29</div>
            <div>效能：<span className="text-green-500">良好</span></div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Home;