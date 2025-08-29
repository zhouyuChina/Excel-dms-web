import React, { useState } from 'react';
import { 
  Database, 
  Eye, 
  Phone, 
  User, 
  Users, 
  Hash, 
  Calendar, 
  DollarSign, 
  Mail,
  Play,
  Zap,
  ChevronRight
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

// 验证规则配置类型
interface ValidationRule {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  enabled: boolean;
}

// 模拟验证统计数据
const mockValidationStats = {
  totalRecords: 156,
  currentScope: 156,
  pendingValidation: true
};

// 验证规则配置
const initialValidationRules: ValidationRule[] = [
  {
    id: 'phone',
    name: '電話號碼',
    description: '驗證電話號碼格式、長度和有效性',
    icon: Phone,
    enabled: true
  },
  {
    id: 'name',
    name: '姓名',
    description: '驗證中文字符和姓名結構',
    icon: User,
    enabled: true
  },
  {
    id: 'englishName',
    name: '英文姓名',
    description: '驗證英文字符、格式和長度',
    icon: Users,
    enabled: true
  },
  {
    id: 'age',
    name: '年齡',
    description: '驗證數值範圍、邏輯和有效性',
    icon: Hash,
    enabled: true
  },
  {
    id: 'birthDate',
    name: '出生日期',
    description: '驗證日期格式和邏輯關聯',
    icon: Calendar,
    enabled: true
  },
  {
    id: 'salary',
    name: '薪資',
    description: '驗證數值範圍、邏輯和有效性',
    icon: DollarSign,
    enabled: true
  },
  {
    id: 'email',
    name: '電子郵件',
    description: '驗證電子郵件格式和網域名有效性',
    icon: Mail,
    enabled: true
  }
];

export const DataValidationPage: React.FC = () => {
  const [validationRules, setValidationRules] = useState<ValidationRule[]>(initialValidationRules);
  const [isValidating, setIsValidating] = useState(false);

  // 处理验证规则开关切换
  const handleRuleToggle = (ruleId: string) => {
    setValidationRules(rules => 
      rules.map(rule => 
        rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
      )
    );
  };

  // 处理查看资料
  const handleViewData = () => {
    console.log('查看验证资料');
  };

  // 处理开始验证
  const handleStartValidation = () => {
    setIsValidating(true);
    console.log('开始验证');
    
    // 模拟验证过程
    setTimeout(() => {
      setIsValidating(false);
      console.log('验证完成');
    }, 3000);
  };

  return (
    <div className="space-y-6">
      {/* 验证资料范围 */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">驗證資料範圍</h2>
              <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                <span>總計：<strong className="text-blue-600">{mockValidationStats.totalRecords} 筆</strong></span>
                <span>目前隱含：<strong className="text-blue-600">{mockValidationStats.currentScope} 筆</strong></span>
              </div>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            onClick={handleViewData}
            className="flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            查看資料
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 验证设置 */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-6 h-6 bg-gray-600 rounded flex items-center justify-center">
              <span className="text-white text-sm font-bold">⚙</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">驗證設置</h3>
          </div>
          
          <div className="space-y-4">
            {validationRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center gap-3">
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                  <rule.icon className="w-5 h-5 text-gray-600" />
                  <div>
                    <div className="font-medium text-gray-900">{rule.name}</div>
                    <div className="text-sm text-gray-500">{rule.description}</div>
                  </div>
                </div>
                
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={() => handleRuleToggle(rule.id)}
                />
              </div>
            ))}
          </div>
          
          {/* 开始验证按钮 */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <Button 
              onClick={handleStartValidation}
              disabled={isValidating || validationRules.every(rule => !rule.enabled)}
              className="w-full bg-gray-600 text-white hover:bg-gray-700 disabled:bg-gray-300"
            >
              <Play className="w-4 h-4 mr-2" />
              {isValidating ? '正在驗證...' : '開始驗證'} (0 個驗證)
            </Button>
          </div>
        </Card>

        {/* 等待验证执行 */}
        <Card className="p-6 flex flex-col items-center justify-center text-center min-h-[400px]">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-gray-400" />
          </div>
          
          <h3 className="text-lg font-semibold text-gray-700 mb-2">等待驗證執行</h3>
          
          <p className="text-gray-500 text-sm mb-6 leading-relaxed max-w-xs">
            配置好驗證設定後，點選「開始驗證」按鈕
          </p>
          
          {isValidating && (
            <div className="flex items-center gap-2 text-blue-600">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm">驗證執行中...</span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};