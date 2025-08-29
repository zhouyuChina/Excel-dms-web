import React, { useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// 分组数据类型
interface FieldGroup {
  id: string;
  name: string;
  color: string;
  fieldCount: number;
  isSystem?: boolean;
}

// 颜色选项
const colorOptions = [
  { value: 'purple', label: '紫色', color: 'bg-purple-500' },
  { value: 'blue', label: '藍色', color: 'bg-blue-500' },
  { value: 'green', label: '綠色', color: 'bg-green-500' },
  { value: 'orange', label: '橙色', color: 'bg-orange-500' },
  { value: 'red', label: '紅色', color: 'bg-red-500' },
  { value: 'cyan', label: '青色', color: 'bg-cyan-500' },
  { value: 'yellow', label: '黃色', color: 'bg-yellow-500' },
  { value: 'pink', label: '粉色', color: 'bg-pink-500' }
];

// 模拟分组数据
const mockGroups: FieldGroup[] = [
  { id: '1', name: '系統欄位', color: 'purple', fieldCount: 4, isSystem: true },
  { id: '2', name: '個人資訊', color: 'blue', fieldCount: 4 },
  { id: '3', name: '工作相關', color: 'green', fieldCount: 3 },
  { id: '4', name: '聯絡方式', color: 'orange', fieldCount: 1 },
  { id: '5', name: '歷史記錄', color: 'red', fieldCount: 3 },
  { id: '6', name: '匯入欄位', color: 'cyan', fieldCount: 0 },
  { id: '7', name: '222', color: 'blue', fieldCount: 0 }
];

export const GroupManagementTab: React.FC = () => {
  const [groups, setGroups] = useState<FieldGroup[]>(mockGroups);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('blue');

  // 处理新增分组
  const handleAddGroup = () => {
    if (newGroupName.trim()) {
      const newGroup: FieldGroup = {
        id: (groups.length + 1).toString(),
        name: newGroupName,
        color: newGroupColor,
        fieldCount: 0
      };
      setGroups([...groups, newGroup]);
      setNewGroupName('');
      setNewGroupColor('blue');
    }
  };

  // 处理编辑分组
  const handleEditGroup = (groupId: string) => {
    console.log('编辑分组:', groupId);
  };

  // 处理删除分组
  const handleDeleteGroup = (groupId: string) => {
    setGroups(groups.filter(group => group.id !== groupId));
  };

  // 获取颜色样式
  const getColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      purple: 'bg-purple-500',
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      orange: 'bg-orange-500',
      red: 'bg-red-500',
      cyan: 'bg-cyan-500',
      yellow: 'bg-yellow-500',
      pink: 'bg-pink-500'
    };
    return colorMap[color] || 'bg-gray-500';
  };

  return (
    <>
      {/* 新增分组 */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">新增分組</h3>
        
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <Input
              placeholder="輸入分組名稱"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
          </div>
          
          <div className="w-32">
            <Select value={newGroupColor} onValueChange={setNewGroupColor}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${option.color}`}></div>
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            onClick={handleAddGroup}
            disabled={!newGroupName.trim()}
            className="bg-gray-600 text-white hover:bg-gray-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            新增
          </Button>
        </div>
      </Card>

      {/* 现有分组 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">現有分組</h3>
          <span className="text-sm text-gray-500 bg-gray-200 rounded-lg px-2 py-1">
            {groups.length} 個分組
          </span>
        </div>
        
        <div className="space-y-3">
          {groups.map((group) => (
            <div 
              key={group.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${getColorClass(group.color)}`}></div>
                <div>
                  <div className="font-medium text-gray-900 flex items-center gap-2">
                    {group.name}
                    {group.isSystem && (
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        系統
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {group.fieldCount} 個欄位
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleEditGroup(group.id)}
                  className="h-8 w-8 p-0"
                >
                  <Edit2 className="w-4 h-4 text-gray-500" />
                </Button>
                
                {!group.isSystem && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDeleteGroup(group.id)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
};