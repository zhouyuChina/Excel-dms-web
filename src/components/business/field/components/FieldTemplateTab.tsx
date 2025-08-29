import React from 'react';
import { FileText, Plus, CheckCircle, Copy } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// 模板数据类型
interface FieldTemplate {
  id: string;
  name: string;
  description: string;
  fieldCount: number;
  fields: string[];
  isSystem: boolean;
}

// 系统内置模板数据
const systemTemplates: FieldTemplate[] = [
  {
    id: '1',
    name: '僅系統欄位',
    description: '只顯示系統必需的基本欄位',
    fieldCount: 4,
    fields: ['CUID', '國家', '提供者', '...'],
    isSystem: true
  },
  {
    id: '2', 
    name: '個人資料',
    description: '顯示個人基本資訊和聯絡方式',
    fieldCount: 7,
    fields: ['CUID', '姓名', '英文姓名', '...'],
    isSystem: true
  },
  {
    id: '3',
    name: '完整資料',
    description: '顯示所有可用欄位',
    fieldCount: 15,
    fields: ['CUID', '國家', '提供者', '...'],
    isSystem: true
  }
];

export const FieldTemplateTab: React.FC = () => {
  // 处理使用模板
  const handleUseTemplate = (templateId: string) => {
    console.log('使用模板:', templateId);
  };

  // 处理复制模板
  const handleCopyTemplate = (templateId: string) => {
    console.log('复制模板:', templateId);
  };

  // 处理创建模板
  const handleCreateTemplate = () => {
    console.log('创建新模板');
  };

  return (
    <div className="space-y-6">
      {/* 模版功能説明 */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-sm">ℹ</span>
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">模版功能説明</h3>
            <p className="text-blue-800 text-sm leading-relaxed">
              欄位模版可以快速切換不同的欄位顯示組合，模版只會控制哪些現有欄位顯示以及它們的排序，不會新增或刪除欄位，您可以建立套會的欄位選取組創建自己的模版，也可以自訂欄位的排序。
            </p>
          </div>
        </div>
      </Card>

      {/* 系統內建模版 */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">系統內建模版</h3>
        
        <div className="space-y-4">
          {systemTemplates.map((template) => (
            <Card key={template.id} className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-base font-semibold text-gray-900">
                      {template.name}
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      系統
                    </Badge>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-3">
                    {template.description}
                  </p>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">
                      顯示 <strong className="text-gray-900">{template.fieldCount}</strong> 個欄位
                    </span>
                    <div className="flex items-center gap-1">
                      {template.fields.map((field, index) => (
                        <span key={index} className="text-gray-500">
                          {field}
                          {index < template.fields.length - 1 && '、'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <Button 
                    onClick={() => handleUseTemplate(template.id)}
                    className="bg-gray-800 text-white hover:bg-gray-900"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    應用
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={() => handleCopyTemplate(template.id)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    複製
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* 自訂模版 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">自訂模版</h3>
          <Button 
            onClick={handleCreateTemplate}
            className="bg-gray-800 text-white hover:bg-gray-900"
          >
            <Plus className="w-4 h-4 mr-2" />
            創建模版
          </Button>
        </div>
        
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">
            尚未創建任何自訂模版
          </h4>
          <p className="text-gray-600 text-sm mb-4">
            點擊上方「創建模版」按鈕開始創建
          </p>
        </Card>
      </div>
    </div>
  );
};