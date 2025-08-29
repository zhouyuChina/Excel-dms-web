import React from 'react';
import { Database, CheckCircle, AlertTriangle, TrendingUp, Users, Download, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

// 模拟数据
const mockStats = {
  totalRecords: 1234,
  validRecords: 1156,
  invalidRecords: 78,
  completeness: 93.7
};

const mockFieldUsage = [
  { name: '姓名', type: 'text', usage: 98.5, complete: 98.5 },
  { name: '年齡', type: 'number', usage: 94.2, complete: 94.2 },
  { name: '職位', type: 'text', usage: 87.3, complete: 87.3 },
  { name: '薪資', type: 'number', usage: 89.1, complete: 89.1 },
  { name: '電子郵件', type: 'email', usage: 76.4, complete: 76.4 },
  { name: '電話', type: 'phone', usage: 62.8, complete: 62.8 }
];

const mockProviderStats = [
  { name: 'CUID', type: '必填', status: 'complete', rate: 100.0, count: '1234 / 1234' },
  { name: '國家', type: '必填', status: 'complete', rate: 100.0, count: '1234 / 1234' },
  { name: '提供者', type: '必填', status: 'complete', rate: 100.0, count: '1234 / 1234' }
];

export const StatisticalAnalysisPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6 text-center">
          <Database className="w-8 h-8 text-blue-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">{mockStats.totalRecords.toLocaleString()}</div>
          <div className="text-sm text-gray-600">總記錄數</div>
        </Card>
        
        <Card className="p-6 text-center">
          <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-green-600">{mockStats.validRecords.toLocaleString()}</div>
          <div className="text-sm text-gray-600">有效記錄</div>
        </Card>
        
        <Card className="p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-red-600">{mockStats.invalidRecords}</div>
          <div className="text-sm text-gray-600">無效記錄</div>
        </Card>
        
        <Card className="p-6 text-center">
          <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-purple-600">{mockStats.completeness}%</div>
          <div className="text-sm text-gray-600">資料完整性</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 栏位使用统计 */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-600 rounded"></div>
              欄位使用統計
            </h3>
          </div>
          
          <div className="space-y-4">
            {mockFieldUsage.map((field, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{field.name}</span>
                    <span className="text-sm text-gray-500">{field.type}</span>
                  </div>
                  <span className="text-sm font-medium">{field.usage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${field.usage}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>使用率: {field.usage}%</span>
                  <span>完整度: {field.complete}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 提供者资料分析 */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5" />
              提供者資料分析
            </h3>
            <div className="flex items-center gap-2">
              <Select defaultValue="所有提供者">
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="所有提供者">所有提供者</SelectItem>
                  <SelectItem value="人事部">人事部</SelectItem>
                  <SelectItem value="財務部">財務部</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-500">1234筆</span>
            </div>
          </div>

          <div className="mb-4">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              匯出狀態統計
            </Button>
          </div>

          {/* 匯出状态统计 */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">69%</div>
              <div className="text-sm text-gray-600">已匯出 (856筆)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">31%</div>
              <div className="text-sm text-gray-600">未匯出 (378筆)</div>
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
            <div className="bg-green-500 h-3 rounded-l-full" style={{ width: '69%' }}></div>
          </div>

          {/* 欄位缺失值分析 */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4" />
              <span className="font-medium">欄位缺失值分析</span>
            </div>
            
            <div className="space-y-3">
              {mockProviderStats.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.name}</span>
                    <Badge className="text-xs bg-red-500 text-white">{item.type}</Badge>
                    <span className="text-sm text-gray-500">{item.status === 'complete' ? '系統' : ''}</span>
                  </div>
                  <div className="text-sm font-medium text-green-600">100.0% 完整</div>
                </div>
              ))}
            </div>
          </div>

          {/* 底部统计 */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">3</div>
              <div className="text-xs text-gray-600">完整欄位</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-orange-600">3</div>
              <div className="text-xs text-gray-600">部分缺失</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-red-600">2</div>
              <div className="text-xs text-gray-600">嚴重缺失</div>
            </div>
          </div>
        </Card>
      </div>

      {/* 资料完整性分析 */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5" />
          <h3 className="text-lg font-semibold">資料完整性分析</h3>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 整体完整性 */}
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900 mb-2">93.7%</div>
            <div className="text-sm text-gray-600 mb-4">必填欄位</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: '93.7%' }}></div>
            </div>
            <div className="text-xs text-gray-500">{mockStats.validRecords} / {mockStats.totalRecords} 記錄完整</div>
          </div>

          {/* 选填栏位 */}
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900 mb-2">76.3%</div>
            <div className="text-sm text-gray-600 mb-4">選填欄位</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: '76.3%' }}></div>
            </div>
          </div>

          {/* 评级 */}
          <div className="text-center">
            <div className="text-6xl font-bold text-green-600 mb-2">A-</div>
            <div className="text-sm text-gray-600 mb-2">整體完整性，學衛性佳—設佳評估</div>
            <div className="text-xs text-gray-500 space-y-1">
              <div>完整性: 93.7%</div>
              <div>準確性: 89.2%</div>
              <div>一致性: 91.5%</div>
            </div>
          </div>
        </div>
      </Card>

      {/* 最後更新时间 */}
      <div className="text-center text-sm text-gray-500">
        最後更新：2024-03-01 16:30
      </div>
    </div>
  );
};