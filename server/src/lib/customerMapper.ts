import type { Customer } from "@prisma/client";

export type CustomerDTO = {
  cuid: string;
  country: string;
  provider: string;
  phone: string;
  name: string;
  englishName: string;
  age: number;
  birthDate: string;
  position: string;
  salary: number;
  email: string;
  department: string;
  importRecord: string;
  exportRecord: string;
  recipient: string;
  isError: boolean;
  attrs: Record<string, unknown>;
};

type CustomerListRow = Pick<
  Customer,
  | "cuid"
  | "country"
  | "provider"
  | "phone"
  | "name"
  | "englishName"
  | "age"
  | "birthDate"
  | "position"
  | "salary"
  | "email"
  | "department"
  | "importRecord"
  | "exportRecord"
  | "recipient"
  | "isError"
> & {
  attrs?: unknown;
};

function normalizeAttrs(attrs: unknown): Record<string, unknown> {
  return attrs && typeof attrs === "object" && !Array.isArray(attrs)
    ? (attrs as Record<string, unknown>)
    : {};
}

export function toDTO(row: Customer): CustomerDTO {
  return {
    cuid: row.cuid,
    country: row.country,
    provider: row.provider,
    phone: row.phone,
    name: row.name,
    englishName: row.englishName,
    age: row.age,
    birthDate: row.birthDate,
    position: row.position,
    salary: row.salary,
    email: row.email,
    department: row.department,
    importRecord: row.importRecord,
    exportRecord: row.exportRecord,
    recipient: row.recipient,
    isError: row.isError,
    attrs: normalizeAttrs(row.attrs),
  };
}

export function toListDTO(row: CustomerListRow, visibleAttrKeys: string[]): CustomerDTO {
  const attrs = normalizeAttrs(row.attrs);
  const projectedAttrs =
    visibleAttrKeys.length === 0
      ? {}
      : Object.fromEntries(
          visibleAttrKeys
            .filter((key) => Object.prototype.hasOwnProperty.call(attrs, key))
            .map((key) => [key, attrs[key]])
        );
  return {
    cuid: row.cuid,
    country: row.country,
    provider: row.provider,
    phone: row.phone,
    name: row.name,
    englishName: row.englishName,
    age: row.age,
    birthDate: row.birthDate,
    position: row.position,
    salary: row.salary,
    email: row.email,
    department: row.department,
    importRecord: row.importRecord,
    exportRecord: row.exportRecord,
    recipient: row.recipient,
    isError: row.isError,
    attrs: projectedAttrs,
  };
}
