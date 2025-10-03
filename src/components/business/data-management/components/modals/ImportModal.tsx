import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  countries: string[];
  providers: string[];
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, fileName, countries, providers }) => {
  const safeCountries = Array.isArray(countries) ? countries : [];
  const safeProviders = Array.isArray(providers) ? providers : [];
  const CUSTOM_PROVIDER = '__CUSTOM__';

  type FormState = { country: string; provider: string; customProvider: string };
  const [form, setForm] = useState<FormState>({ country: safeCountries[0] || '', provider: CUSTOM_PROVIDER, customProvider: '' });

  const isUsingCustomProvider = !form.provider || form.provider === CUSTOM_PROVIDER;
  const fileBaseName = useMemo(() => {
    if (!fileName) return '';
    const lastDot = fileName.lastIndexOf('.');
    return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
  }, [fileName]);

  // 每次開啟或檔名改變時，重設為預設狀態（不記憶上次操作）
  useEffect(() => {
    if (isOpen) {
      setForm({ country: safeCountries[0] || '', provider: CUSTOM_PROVIDER, customProvider: '' });
    }
  }, [isOpen, fileName]);

  const handleImport = () => {
    const providerFinal = isUsingCustomProvider ? (form.customProvider || fileBaseName) : form.provider;
    console.log('匯入設定', { fileName, country: form.country, provider: providerFinal });
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">設定匯入資料</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">請設定資料提供者和國家資訊</p>

        <div className="space-y-4">
          {/* 國家選擇 */}
          <div>
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">國家</Label>
            <Select value={form.country || undefined} onValueChange={(v) => setForm(s => ({ ...s, country: v }))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {safeCountries.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 資料提供者選擇或自訂 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">資料提供者</Label>
            <Select value={form.provider || undefined} onValueChange={(v) => setForm(s => ({ ...s, provider: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="選擇提供者" />
              </SelectTrigger>
              <SelectContent>
                {safeProviders.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
                <SelectItem value={CUSTOM_PROVIDER}>自訂提供者</SelectItem>
              </SelectContent>
            </Select>

            {isUsingCustomProvider && (
              <div>
                <Label className="text-sm text-gray-700 dark:text-gray-300">自訂提供者</Label>
                <Input
                  className="mt-1"
                  value={form.customProvider || fileBaseName}
                  onChange={(e) => setForm(s => ({ ...s, customProvider: e.target.value }))}
                  placeholder="輸入提供者名稱（預設帶入檔名）"
                />
                <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
                  <Lightbulb className="w-4 h-4 mr-1" />
                  已自動填入檔案名稱，您可以直接使用或自行修改
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleImport} className="bg-gray-900 hover:bg-gray-800 text-white" disabled={!fileName}>
            確定匯入
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};



