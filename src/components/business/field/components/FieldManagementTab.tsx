import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Check, X, GripVertical, Move } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface Field {
  id: string;
  name: string;
  type: string;
  category: string;
  isRequired: boolean;
  isSystem: boolean;
  group: string;
}

interface FieldManagementTabProps {
  fields: Field[];
  onAddField: (field: Omit<Field, 'id'>) => void;
  onEditField: (fieldId: string, updatedField: Partial<Field>) => void;
  onDeleteField: (fieldId: string) => void;
  onReorderFields: (reorderedFields: Field[]) => void;
}

export const FieldManagementTab: React.FC<FieldManagementTabProps> = ({
  fields,
  onAddField,
  onEditField,
  onDeleteField,
  onReorderFields
}) => {
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('文字');
  const [newFieldGroup, setNewFieldGroup] = useState('無分組');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  // const [isDragMode, setIsDragMode] = useState(false);

  const handleAddField = () => {
    if (newFieldName.trim()) {
      onAddField({
        name: newFieldName,
        type: newFieldType,
        category: '',
        isRequired: newFieldRequired,
        isSystem: false,
        group: newFieldGroup
      });
      
      setNewFieldName('');
      setNewFieldType('文字');
      setNewFieldGroup('無分組');
      setNewFieldRequired(false);
    }
  };

  const handleStartEdit = (field: Field) => {
    setEditingFieldId(field.id);
    setEditingField({ ...field });
  };

  const handleSaveEdit = () => {
    if (editingField && editingFieldId) {
      onEditField(editingFieldId, editingField);
      setEditingFieldId(null);
      setEditingField(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingFieldId(null);
    setEditingField(null);
  };

  const handleEditFieldChange = (key: keyof Field, value: any) => {
    if (editingField) {
      setEditingField({
        ...editingField,
        [key]: value
      });
    }
  };

  // 拖拽排序相关函数
  const handleDragStart = (e: React.DragEvent, index: number) => {
    // 前四个系统栏位不允许拖拽
    if (index < 4) {
      e.preventDefault();
      return;
    }
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    // 前四个系统栏位不允许作为拖拽目标
    if (index < 4) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || dropIndex < 4 || draggedIndex < 4) {
      return;
    }

    if (draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newFields = [...fields];
    const draggedField = newFields[draggedIndex];
    
    // 移除被拖拽的元素
    newFields.splice(draggedIndex, 1);
    // 在新位置插入
    newFields.splice(dropIndex, 0, draggedField);
    
    onReorderFields(newFields);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const getFieldIcon = (field: Field) => {
    if (field.isSystem) {
      return <div className="w-3 h-3 bg-green-500 rounded-full"></div>;
    }
    return <div className="w-3 h-3 bg-gray-400 rounded-full"></div>;
  };

  const getFieldTypeColor = (type: string) => {
    switch (type) {
      case '必填':
        return 'bg-red-500 text-white';
      case '系統':
        return 'bg-gray-500 text-white';
      default:
        return 'bg-blue-500 text-white';
    }
  };

  return (
    <>
      {/* 新增栏位 */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">新增欄位</h3>
        
        <div className="flex gap-5 items-end">
          <div className="w-1/3">
            <Input
              placeholder="輸入欄位名稱"
              value={newFieldName}
              onChange={(e) => setNewFieldName(e.target.value)}
            />
          </div>
          
          <div>
            <Select value={newFieldType} onValueChange={setNewFieldType}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="文字">文字</SelectItem>
                <SelectItem value="數字">數字</SelectItem>
                <SelectItem value="日期">日期</SelectItem>
                <SelectItem value="電子郵件">電子郵件</SelectItem>
                <SelectItem value="電話">電話</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Select value={newFieldGroup} onValueChange={setNewFieldGroup}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="無分組">無分組</SelectItem>
                <SelectItem value="個人資訊">個人資訊</SelectItem>
                <SelectItem value="工作相關">工作相關</SelectItem>
                <SelectItem value="聯絡方式">聯絡方式</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="required-field"
              checked={newFieldRequired}
              onChange={(e) => setNewFieldRequired(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mb-3"
            />
            <label htmlFor="required-field" className="text-sm text-gray-700 mb-3">
              必填
            </label>
          </div>
          
          <div>
            <Button 
              onClick={handleAddField}
              className="bg-gray-600 text-white hover:bg-gray-700"
              disabled={!newFieldName.trim()}
            >
              <Plus className="w-4 h-4 mr-2" />
              新增
            </Button>
          </div>
        </div>
      </Card>

      {/* 现有栏位 */}
      <Card className="p-6">
        <div className="flex items-center mb-4 gap-2">
          <h3 className="text-lg font-semibold text-gray-900">現有欄位</h3>
          <span className="text-sm text-gray-500 ml-2 bg-gray-200 rounded-lg text-gray-700 px-2 py-1">{fields.length} 個欄位</span>
          <p className="text-sm text-gray-600 ml-4">點擊編輯欄位或可修改欄位的所有屬性</p>
          
          {/* 拖拽排序标识 */}
          <div className="ml-auto flex items-center gap-2 text-blue-600">
            <Move className="w-4 h-4" />
            <span className="text-sm">拖拽排序</span>
            <span className="text-xs text-gray-500">(前4項系統欄位不可移動)</span>
          </div>
        </div>
        
        {/* 栏位列表 */}
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div 
              key={field.id} 
              draggable={index >= 4 && editingFieldId !== field.id}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors ${
                index >= 4 && editingFieldId !== field.id ? 'cursor-move' : ''
              } ${
                draggedIndex === index ? 'opacity-50' : ''
              } ${
                index < 4 ? 'bg-blue-50 border border-blue-200' : ''
              }`}
            >
              {editingFieldId === field.id ? (
                // 编辑模式
                <>
                  <div className="flex items-center gap-3 flex-1">
                    {getFieldIcon(field)}
                    
                    <Input
                      value={editingField?.name || ''}
                      onChange={(e) => handleEditFieldChange('name', e.target.value)}
                      className="w-40"
                    />
                    
                    <Select 
                      value={editingField?.type || ''} 
                      onValueChange={(value) => handleEditFieldChange('type', value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="文字">文字</SelectItem>
                        <SelectItem value="數字">數字</SelectItem>
                        <SelectItem value="日期">日期</SelectItem>
                        <SelectItem value="電子郵件">電子郵件</SelectItem>
                        <SelectItem value="電話">電話</SelectItem>
                        <SelectItem value="系統">系統</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select 
                      value={editingField?.group || ''} 
                      onValueChange={(value) => handleEditFieldChange('group', value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="系統欄位">系統欄位</SelectItem>
                        <SelectItem value="個人資訊">個人資訊</SelectItem>
                        <SelectItem value="工作相關">工作相關</SelectItem>
                        <SelectItem value="聯絡方式">聯絡方式</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editingField?.isRequired || false}
                        onChange={(e) => handleEditFieldChange('isRequired', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">必填</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handleSaveEdit}
                      className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handleCancelEdit}
                      className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              ) : (
                // 显示模式
                <>
                  <div className="flex items-center gap-3">
                    {/* 拖拽手柄 */}
                    {index >= 4 && editingFieldId !== field.id && (
                      <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                    )}
                    {index < 4 && (
                      <div className="w-4 h-4"></div> // 占位符保持对齐
                    )}
                    
                    {getFieldIcon(field)}
                    <span className="font-medium text-gray-900">{field.name}</span>
                    
                    {field.type && (
                      <Badge 
                        className={`text-xs ${
                          field.type === '必填' 
                            ? 'bg-red-500 text-white' 
                            : getFieldTypeColor(field.type)
                        }`}
                      >
                        {field.type}
                      </Badge>
                    )}
                    
                    {field.category && (
                      <span className="text-sm text-gray-600">{field.category}</span>
                    )}
                    
                    {field.group && field.group !== '系統欄位' && (
                      <Badge variant="outline" className="text-xs">
                        {field.group}
                      </Badge>
                    )}
                    
                    {field.isRequired && (
                      <Badge className="text-xs bg-red-500 text-white">
                        必填
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleStartEdit(field)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    
                    {!field.isSystem && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onDeleteField(field.id)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
};