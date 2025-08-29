import React, { useState } from 'react';
import { Settings, Users, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  FieldManagementTab, 
  GroupManagementTab, 
  FieldTemplateTab, 
  Field 
} from './components';

const mockFields: Field[] = [
  { id: '1', name: 'CUID', type: '系統', category: '文字', isRequired: true, isSystem: true, group: '系統欄位' },
  { id: '2', name: '國家', type: '系統', category: '文字', isRequired: true, isSystem: true, group: '系統欄位' },
  { id: '3', name: '提供者', type: '系統', category: '文字', isRequired: false, isSystem: true, group: '系統欄位' },
  { id: '4', name: '電話號碼', type: '系統', category: '電話', isRequired: true, isSystem: true, group: '系統欄位' },
  { id: '5', name: '姓名', type: '中文姓名', category: '', isRequired: true, isSystem: false, group: '個人資訊' },
  { id: '6', name: '英文姓名', type: '英文姓名', category: '', isRequired: false, isSystem: false, group: '個人資訊' },
  { id: '7', name: '年齡', type: '數字', category: '', isRequired: true, isSystem: false, group: '個人資訊' },
  { id: '8', name: '出生日期', type: '日期', category: '', isRequired: true, isSystem: false, group: '個人資訊' },
  { id: '9', name: '職位', type: '文字', category: '', isRequired: false, isSystem: false, group: '工作相關' },
  { id: '10', name: '薪資', type: '數字', category: '', isRequired: false, isSystem: false, group: '工作相關' },
  { id: '11', name: '電子郵件', type: '電子郵件', category: '', isRequired: false, isSystem: false, group: '聯絡方式' },
  { id: '12', name: '部門', type: '文字', category: '', isRequired: false, isSystem: false, group: '工作相關' },
];

export const FieldManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('field-management');
  const [fields, setFields] = useState(mockFields);

  const handleAddField = (newField: Omit<Field, 'id'>) => {
    const field: Field = {
      ...newField,
      id: (fields.length + 1).toString(),
    };
    setFields([...fields, field]);
  };

  const handleEditField = (fieldId: string, updatedField: Partial<Field>) => {
    setFields(fields.map(field => 
      field.id === fieldId ? { ...field, ...updatedField } : field
    ));
  };

  const handleDeleteField = (fieldId: string) => {
    setFields(fields.filter(field => field.id !== fieldId));
  };

  const handleReorderFields = (reorderedFields: Field[]) => {
    setFields(reorderedFields);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'field-management':
        return (
          <FieldManagementTab
            fields={fields}
            onAddField={handleAddField}
            onEditField={handleEditField}
            onDeleteField={handleDeleteField}
            onReorderFields={handleReorderFields}
          />
        );
      case 'group-management':
        return <GroupManagementTab />;
      case 'field-template':
        return <FieldTemplateTab />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部导航标签 */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <Button
          variant={activeTab === 'field-management' ? 'default' : 'ghost'}
          className={`flex-1 flex items-center justify-center gap-2 ${
            activeTab === 'field-management' 
              ? 'bg-white shadow-sm text-black' 
              : 'hover:bg-gray-200 text-gray-700'
          }`}
          onClick={() => setActiveTab('field-management')}
        >
          <Settings className="w-5 h-5" />
          <span>欄位管理</span>
        </Button>
        
        <Button
          variant={activeTab === 'group-management' ? 'default' : 'ghost'}
          className={`flex-1 flex items-center justify-center gap-2 ${
            activeTab === 'group-management' 
              ? 'bg-white shadow-sm text-black' 
              : 'hover:bg-gray-200 text-gray-700'
          }`}
          onClick={() => setActiveTab('group-management')}
        >
          <Users className="w-5 h-5" />
          <span>分組管理</span>
        </Button>
        
        <Button
          variant={activeTab === 'field-template' ? 'default' : 'ghost'}
          className={`flex-1 flex items-center justify-center gap-2 ${
            activeTab === 'field-template' 
              ? 'bg-white shadow-sm text-black' 
              : 'hover:bg-gray-200 text-gray-700'
          }`}
          onClick={() => setActiveTab('field-template')}
        >
          <FileText className="w-5 h-5" />
          <span>欄位模板</span>
        </Button>
      </div>

      {/* 标签页内容 */}
      {renderTabContent()}
    </div>
  );
};