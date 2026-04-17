import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import type { RecordData } from "@/data/mockData";

const cellInput =
  "h-8 w-full min-w-[4.5rem] max-w-[14rem] text-sm px-2 py-1 border border-input rounded-md bg-background";

/** 後端寫入 `import:<jobId>:YYYY-MM-DD`；列表改為易讀，完整值放 title */
function formatImportRecordDisplay(value: string): ReactNode {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const m = /^import:([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(raw);
  if (!m) return raw;
  const importJobId = m[1] || "";
  const date = m[2] || "";
  return (
    <div className="leading-tight" title={raw}>
      <div>{date}</div>
      <div className="text-[10px] text-gray-500">匯入批次 {importJobId.slice(0, 8)}</div>
    </div>
  );
}

export type RecordCellEditHandlers = {
  draft: RecordData;
  onPatch: (patch: Partial<RecordData>) => void;
  onPatchAttrs?: (key: string, value: unknown) => void;
};

/** 依欄位顯示名稱（與後端 FieldDefinition.name 一致）渲染儲存格；`edit` 有值時為可編輯列 */
export function renderRecordCell(
  record: RecordData,
  columnKey: string,
  edit?: RecordCellEditHandlers | null
): ReactNode {
  if (edit) {
    const { draft, onPatch } = edit;
    switch (columnKey) {
      case "cuid":
        return (
          <div className="flex items-center justify-center font-mono text-xs text-muted-foreground">
            {draft.cuid}
          </div>
        );
      case "country":
        return <span className="text-muted-foreground">{draft.country}</span>;
      case "phone":
        return <span className="text-muted-foreground">{draft.phone}</span>;
      case "provider":
        return (
          <Input
            className={cellInput}
            value={draft.provider}
            onChange={(e) => onPatch({ provider: e.target.value })}
          />
        );
      case "name":
        return (
          <Input
            className={cellInput}
            value={draft.name}
            onChange={(e) => onPatch({ name: e.target.value })}
          />
        );
      case "englishName":
        return (
          <Input
            className={cellInput}
            value={draft.englishName}
            onChange={(e) => onPatch({ englishName: e.target.value })}
          />
        );
      case "age":
        return (
          <Input
            type="number"
            className={cellInput}
            value={draft.age === 0 ? "" : draft.age}
            onChange={(e) => onPatch({ age: Number(e.target.value) || 0 })}
          />
        );
      case "birthDate":
        return (
          <Input
            className={cellInput}
            value={draft.birthDate}
            onChange={(e) => onPatch({ birthDate: e.target.value })}
          />
        );
      case "position":
        return (
          <Input
            className={cellInput}
            value={draft.position}
            onChange={(e) => onPatch({ position: e.target.value })}
          />
        );
      case "salary":
        return (
          <Input
            type="number"
            className={cellInput}
            value={draft.salary === 0 ? "" : draft.salary}
            onChange={(e) => onPatch({ salary: Number(e.target.value) || 0 })}
          />
        );
      case "email":
        return (
          <Input
            className={cellInput}
            value={draft.email}
            onChange={(e) => onPatch({ email: e.target.value })}
          />
        );
      case "department":
        return (
          <Input
            className={cellInput}
            value={draft.department}
            onChange={(e) => onPatch({ department: e.target.value })}
          />
        );
      case "importRecord":
        return (
          <Input
            className={cellInput}
            value={draft.importRecord}
            onChange={(e) => onPatch({ importRecord: e.target.value })}
          />
        );
      case "exportRecord":
        return (
          <Input
            className={cellInput}
            value={draft.exportRecord}
            onChange={(e) => onPatch({ exportRecord: e.target.value })}
          />
        );
      case "recipient":
        return (
          <Input
            className={cellInput}
            value={draft.recipient}
            onChange={(e) => onPatch({ recipient: e.target.value })}
          />
        );
      default:
        return (
          <Input
            className={cellInput}
            value={String((draft.attrs as any)?.[columnKey] ?? "")}
            onChange={(e) => {
              const next = { ...(draft.attrs || {}) } as Record<string, unknown>;
              next[columnKey] = e.target.value;
              onPatch({ attrs: next });
            }}
          />
        );
    }
  }

  switch (columnKey) {
    case "cuid":
      return (
        <div className="flex items-center justify-center">
          {record.cuid}
        </div>
      );
    case "country":
      return record.country;
    case "provider":
      return record.provider;
    case "phone":
      return record.phone;
    case "name":
      return record.name;
    case "englishName":
      return record.englishName;
    case "age":
      return record.age;
    case "birthDate":
      return record.birthDate;
    case "position":
      return record.position;
    case "salary":
      return record.salary.toLocaleString();
    case "email":
      return record.email;
    case "department":
      return record.department;
    case "importRecord":
      return formatImportRecordDisplay(record.importRecord);
    case "exportRecord":
      return record.exportRecord;
    case "recipient":
      return record.recipient;
    default:
      return String((record.attrs as any)?.[columnKey] ?? "");
  }
}
