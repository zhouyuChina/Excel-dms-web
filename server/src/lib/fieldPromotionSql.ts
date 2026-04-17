const IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;

function normalizeKey(key: string): string {
  const normalized = String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) {
    throw new Error("field_promotion_invalid_key");
  }
  return normalized;
}

export function toPromotedColumnName(fieldKey: string): string {
  const normalized = normalizeKey(fieldKey);
  const column = `fp_${normalized}`;
  if (!IDENTIFIER_RE.test(column)) {
    throw new Error("field_promotion_invalid_column_identifier");
  }
  if (column.length > 63) {
    return column.slice(0, 63);
  }
  return column;
}

export function resolvePromotedColumnName(input: string, fallbackFieldKey?: string): string {
  const raw = String(input || "").trim().toLowerCase();
  if (raw) {
    const normalized = normalizeKey(raw);
    const column = normalized.startsWith("fp_") ? normalized : `fp_${normalized}`;
    if (!IDENTIFIER_RE.test(column)) {
      throw new Error("field_promotion_invalid_column_identifier");
    }
    return column.length > 63 ? column.slice(0, 63) : column;
  }
  if (!fallbackFieldKey) {
    throw new Error("field_promotion_missing_column_name");
  }
  return toPromotedColumnName(fallbackFieldKey);
}

export function quoteIdentifier(identifier: string): string {
  if (!IDENTIFIER_RE.test(identifier)) {
    throw new Error("field_promotion_invalid_identifier");
  }
  return `"${identifier}"`;
}
