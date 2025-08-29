import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Eye, 
  Search, 
  Filter,
  Book,
  Settings,
  HelpCircle,
  Wrench
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

// 文档数据类型
interface Document {
  id: string;
  title: string;
  description: string;
  version: string;
  date: string;
  size: string;
  category: string;
  tags: string[];
  status: 'initial' | 'updated' | 'deprecated';
}

// 模拟文档数据
const mockDocuments: Document[] = [
  {
    id: '1',
    title: '系統概覽文檔',
    description: '完整的系統架構介紹，包括資源庫用設計、營運服務架構、效能需求和核心功能概述說明',
    version: 'v2.0.0',
    date: '2024-12-22',
    size: '128 KB',
    category: 'core',
    tags: ['系統架構', '功能概覽', '營業現況'],
    status: 'initial'
  },
  {
    id: '2',
    title: '技術規格文檔',
    description: '詳細的技術實作規範，包括開發環境、技術棧、程式碼規則和整合指南',
    version: 'v2.0.0',
    date: '2024-12-22',
    size: '256 KB',
    category: 'technical',
    tags: ['技術棧', '程式碼規範', '開發環境'],
    status: 'updated'
  },
  {
    id: '3',
    title: '組件設計文檔',
    description: '詳細的組件架構設計，包括大大核心嵌架的設計規則和實作方式',
    version: 'v2.0.0',
    date: '2024-12-22',
    size: '512 KB',
    category: 'technical',
    tags: ['組件架構', 'React', 'UI設計'],
    status: 'deprecated'
  }
];

// 文档类别配置
const documentCategories = [
  { id: 'core', label: '核心文檔', icon: Book, color: 'blue', count: 1 },
  { id: 'technical', label: '技術文檔', icon: Settings, color: 'green', count: 2 },
  { id: 'guide', label: '使用指南', icon: HelpCircle, color: 'purple', count: 2 },
  { id: 'support', label: '支援文檔', icon: Wrench, color: 'orange', count: 4 }
];

export const DocumentCenterPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('所有類別');
  const [filteredDocs, setFilteredDocs] = useState(mockDocuments);

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    filterDocuments(value, selectedCategory);
  };

  // 处理分类筛选
  const handleCategoryFilter = (category: string) => {
    setSelectedCategory(category);
    filterDocuments(searchTerm, category);
  };

  // 筛选文档
  const filterDocuments = (search: string, category: string) => {
    let filtered = mockDocuments;
    
    if (search) {
      filtered = filtered.filter(doc =>
        doc.title.toLowerCase().includes(search.toLowerCase()) ||
        doc.description.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    if (category !== '所有類別') {
      const categoryId = documentCategories.find(cat => cat.label === category)?.id;
      if (categoryId) {
        filtered = filtered.filter(doc => doc.category === categoryId);
      }
    }
    
    setFilteredDocs(filtered);
  };

  // 获取状态标签样式
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'initial':
        return <Badge className="bg-green-500 text-white text-xs">初修版</Badge>;
      case 'updated':
        return <Badge className="bg-yellow-500 text-white text-xs">中修</Badge>;
      case 'deprecated':
        return <Badge className="bg-red-500 text-white text-xs">過期</Badge>;
      default:
        return null;
    }
  };

  // 处理预览
  const handlePreview = (docId: string) => {
    console.log('预览文档:', docId);
  };

  // 处理下载
  const handleDownload = (docId: string) => {
    console.log('下载文档:', docId);
  };

  // 处理下载全部
  const handleDownloadAll = () => {
    console.log('下载全部文档');
  };

  // 按类别分组文档
  const groupedDocuments = documentCategories.reduce((acc, category) => {
    const categoryDocs = filteredDocs.filter(doc => doc.category === category.id);
    if (categoryDocs.length > 0) {
      acc[category.id] = {
        ...category,
        documents: categoryDocs
      };
    }
    return acc;
  }, {} as Record<string, any>);

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">文檔下載中心</h1>
          <p className="text-gray-600 mt-1">
            企業資料管理系統完整技術文檔庫，包含系統概覽、技術規格、開發指南等
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileText className="w-4 h-4" />
            <span>9 份文檔</span>
          </div>
          <Button onClick={handleDownloadAll} className="bg-gray-800 text-white hover:bg-gray-900">
            <Download className="w-4 h-4 mr-2" />
            下載全部
          </Button>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="搜尋文檔標題、描述或標籤..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 bg-gray-50 border-gray-200"
          />
        </div>
        
        <Select value={selectedCategory} onValueChange={handleCategoryFilter}>
          <SelectTrigger className="w-40 bg-gray-50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="所有類別">所有類別</SelectItem>
            {documentCategories.map(category => (
              <SelectItem key={category.id} value={category.label}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 文档类型统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {documentCategories.map((category) => (
          <Card key={category.id} className="p-4 text-center hover:shadow-md transition-shadow cursor-pointer">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 bg-${category.color}-100`}>
              <category.icon className={`w-6 h-6 text-${category.color}-600`} />
            </div>
            <div className={`text-2xl font-bold text-${category.color}-600 mb-1`}>
              {category.count}
            </div>
            <div className="text-sm text-gray-600">{category.label}</div>
          </Card>
        ))}
      </div>

      {/* 文档列表 */}
      <div className="space-y-6">
        {Object.entries(groupedDocuments).map(([categoryId, categoryData]) => (
          <div key={categoryId}>
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                {categoryData.label}
              </h2>
              <span className="text-sm text-gray-500">
                {categoryData.documents.length}
              </span>
            </div>
            
            <div className="space-y-4">
              {categoryData.documents.map((doc: Document) => (
                <Card key={doc.id} className="p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <h3 className="font-semibold text-gray-900">{doc.title}</h3>
                        {getStatusBadge(doc.status)}
                        <span className="text-sm text-gray-500">{doc.version}</span>
                      </div>
                      
                      <p className="text-gray-600 text-sm mb-3 leading-relaxed">
                        {doc.description}
                      </p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                        <span>📅 {doc.date}</span>
                        <span>💾 {doc.size}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {doc.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        <span className="text-sm text-gray-400">+{doc.tags.length > 3 ? doc.tags.length - 3 : 0}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreview(doc.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(doc.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {filteredDocs.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">沒有找到相關文檔</h3>
          <p className="text-gray-600">請嘗試調整搜尋條件或篩選選項</p>
        </div>
      )}
    </div>
  );
};