import * as XLSX from "xlsx";
import { cuidFromCountryPhone, normalizePhoneDigits } from "./cuid.js";

const MAX_ROWS = 100_000;

export type ImportSheetRow = Record<string, unknown>;

export type FieldDefinitionLike = {
  key: string;
  name: string;
  aliases: unknown;
  type: string;
};

export type NewFieldSeed = {
  key: string;
  name: string;
  type: string;
  aliases: string[];
  source: "import";
  defaultVisible: boolean;
  isExportable: boolean;
};

/** 使用者對每個表頭的決策（key 為試算表原始表頭字串） */
export type ImportColumnMappingEntry =
  | { mode: "skip" }
  | { mode: "merge"; targetKey: string }
  | { mode: "new" };

export type ImportColumnAnalysis = {
  header: string;
  normalized: string;
  kind: "core" | "existing" | "new";
  suggestedKey: string;
};

function mojibakeScore(input: string): number {
  const s = String(input || "");
  let score = 0;
  score += (s.match(/Ã|Â|Ð|Ñ|�/g) || []).length * 3;
  score += (s.match(/[À-ÿ]{2,}/g) || []).length * 2;
  return score;
}

function maybeRepairMojibake(input: string): string {
  const s = String(input || "");
  const looksBroken = /Ã|Â|Ð|Ñ|�/.test(s) || /[À-ÿ]{2,}/.test(s);
  if (!looksBroken) return s;
  try {
    const repaired = Buffer.from(s, "latin1").toString("utf8");
    return repaired || s;
  } catch {
    return s;
  }
}

function decodeCsvBuffer(buffer: Buffer): string {
  const utf8 = buffer.toString("utf8");
  const latin1 = buffer.toString("latin1");
  const latin1Repaired = maybeRepairMojibake(latin1);
  const utf8Repaired = maybeRepairMojibake(utf8);
  const candidates = [utf8, utf8Repaired, latin1Repaired, latin1];
  return candidates.sort((a, b) => mojibakeScore(a) - mojibakeScore(b))[0] || utf8;
}

export function normalizeHeader(raw: string): string {
  return maybeRepairMojibake(String(raw || ""))
    .trim()
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/[()\[\]{}]/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugKey(input: string): string {
  const s = normalizeHeader(input)
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^_+|_+$/g, "");
  return s || "field";
}

function aliasesToNormalizedSet(v: unknown): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(v)) return out;
  for (const a of v) {
    const n = normalizeHeader(String(a ?? ""));
    if (n) out.add(n);
  }
  return out;
}

function builtinHeaderToKey(nh: string): string | null {
  // 依需求：First name=英文姓名，Last name=中文姓名
  if (nh === "first name" || nh === "firstname") return "englishName";
  if (nh === "last name" || nh === "lastname") return "name";
  if (nh === "姓名" || nh === "中文姓名" || nh === "名字" || nh === "名稱" || nh === "聯絡人" || nh === "联系人")
    return "name";
  if (
    nh === "english name" ||
    nh === "英文姓名" ||
    nh === "英文名" ||
    nh === "英文名字" ||
    nh === "英文名稱" ||
    nh === "英文暱稱" ||
    nh === "英文昵称"
  )
    return "englishName";

  if (
    nh === "phone" ||
    nh === "phone number" ||
    nh === "mobile phone" ||
    nh === "mobilephone" ||
    nh === "mobile" ||
    nh === "tel" ||
    nh === "telephone" ||
    nh === "cell"
  )
    return "phone";
  if (
    nh === "電話" ||
    nh === "电话" ||
    nh === "手機" ||
    nh === "手机" ||
    nh === "電話號碼" ||
    nh === "电话号码" ||
    nh === "聯絡電話" ||
    nh === "联系电话" ||
    nh === "行動電話" ||
    nh === "手機號碼" ||
    nh === "手机号" ||
    nh === "手机号码"
  )
    return "phone";
  // 容忍帶說明的表頭，如：電話 含國碼、mobile phone (with country code)
  if (
    (nh.includes("phone") || nh.includes("mobile") || nh.includes("telephone") || nh.includes("tel")) &&
    !nh.includes("email")
  )
    return "phone";
  if ((nh.includes("電話") || nh.includes("电话") || nh.includes("手機") || nh.includes("手机")) && !nh.includes("郵件") && !nh.includes("邮件")) return "phone";
  if (
    nh === "email" ||
    nh === "email address" ||
    nh === "e mail" ||
    nh === "mail" ||
    nh === "電子郵件" ||
    nh === "电子邮件" ||
    nh === "郵件" ||
    nh === "邮件" ||
    nh === "信箱" ||
    nh === "郵箱" ||
    nh === "邮箱"
  )
    return "email";
  if (
    nh === "department" ||
    nh === "部門" ||
    nh === "部门" ||
    nh === "部別" ||
    nh === "單位" ||
    nh === "单位" ||
    nh === "科別" ||
    nh === "組別" ||
    nh === "組織" ||
    nh === "组织"
  )
    return "department";
  if (
    nh === "position" ||
    nh === "title" ||
    nh === "職位" ||
    nh === "职位" ||
    nh === "職稱" ||
    nh === "职称" ||
    nh === "崗位" ||
    nh === "岗位" ||
    nh === "角色"
  )
    return "position";
  if (nh === "age" || nh === "年齡" || nh === "年龄" || nh === "歲" || nh === "岁") return "age";
  if (
    nh === "birth" ||
    nh === "birth date" ||
    nh === "birthday" ||
    nh === "出生日期" ||
    nh === "生日" ||
    nh === "出生年月日" ||
    nh === "出生年月"
  )
    return "birthDate";
  if (
    nh === "salary" ||
    nh === "薪資" ||
    nh === "薪资" ||
    nh === "薪水" ||
    nh === "工資" ||
    nh === "工资" ||
    nh === "月薪" ||
    nh === "年薪" ||
    nh === "待遇"
  )
    return "salary";

  // 中文常見包含式容錯
  if (nh.includes("姓名") || nh.includes("聯絡人") || nh.includes("联系人")) return "name";
  if (nh.includes("英文") && (nh.includes("姓名") || nh.includes("名稱") || nh.includes("名字"))) return "englishName";
  if (nh.includes("英文") && (nh.includes("姓名") || nh.includes("名称") || nh.includes("名字"))) return "englishName";
  if (nh.includes("郵件") || nh.includes("邮件") || nh.includes("信箱") || nh.includes("郵箱") || nh.includes("邮箱"))
    return "email";
  if (nh.includes("部門") || nh.includes("部门") || nh.includes("單位") || nh.includes("单位")) return "department";
  if (nh.includes("職") || nh.includes("岗") || nh.includes("崗")) return "position";
  if (nh.includes("生日") || nh.includes("出生")) return "birthDate";
  if (nh.includes("薪") || nh.includes("工資") || nh.includes("工资")) return "salary";
  if (nh.includes("年齡") || nh.includes("年龄")) return "age";
  return null;
}

function guessTypeFromHeader(nh: string): string {
  if (/(date|day|birthday|出生|日期)/i.test(nh)) return "日期";
  if (/(age|年齡|salary|薪資|金額|amount|price)/i.test(nh)) return "數字";
  if (/(email|郵件)/i.test(nh)) return "電子郵件";
  if (/(phone|mobile|tel|電話|手機)/i.test(nh)) return "電話";
  return "文字";
}

const CORE_KEYS = new Set([
  "phone",
  "name",
  "englishName",
  "email",
  "department",
  "position",
  "age",
  "birthDate",
  "salary",
]);

export function importCellStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return maybeRepairMojibake(String(v)).trim();
}

function cellStr(v: unknown): string {
  return importCellStr(v);
}

function cellNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function parseImportBuffer(buffer: Buffer, fileName: string) {
  const lower = fileName.toLowerCase();
  if (!/\.(xlsx|xls|csv)$/i.test(lower)) {
    return { sheetRows: [] as ImportSheetRow[], fatal: "僅支援 .xlsx / .xls / .csv" };
  }

  let sheetRows: ImportSheetRow[];
  try {
    const wb = /\.csv$/i.test(lower)
      ? XLSX.read(decodeCsvBuffer(buffer), { type: "string", cellDates: false, raw: false })
      : XLSX.read(buffer, { type: "buffer", cellDates: false });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return { sheetRows: [] as ImportSheetRow[], fatal: "empty_workbook" };
    const sheet = wb.Sheets[sheetName];
    sheetRows = XLSX.utils.sheet_to_json<ImportSheetRow>(sheet, {
      defval: "",
      raw: false,
    });
  } catch {
    return { sheetRows: [] as ImportSheetRow[], fatal: "parse_failed" };
  }

  if (sheetRows.length > MAX_ROWS) {
    return { sheetRows: [] as ImportSheetRow[], fatal: `超過列數上限 ${MAX_ROWS}` };
  }
  if (sheetRows.length === 0) return { sheetRows: [] as ImportSheetRow[], fatal: "no_data_rows" };

  return { sheetRows, fatal: null as string | null };
}

function pushNewFieldFromHeader(
  h: string,
  nh: string,
  usedKeys: Set<string>,
  newFields: NewFieldSeed[]
): string {
  let key = slugKey(h);
  if (CORE_KEYS.has(key)) key = `x_${key}`;
  let suffix = 2;
  while (usedKeys.has(key)) {
    key = `${slugKey(h)}_${suffix++}`;
  }
  usedKeys.add(key);
  newFields.push({
    key,
    name: String(h || key).trim() || key,
    type: guessTypeFromHeader(nh),
    aliases: Array.from(new Set([String(h).trim(), nh].filter(Boolean))),
    source: "import",
    defaultVisible: true,
    isExportable: true,
  });
  return key;
}

function buildNormalizedToKeyMap(existingFields: FieldDefinitionLike[]) {
  const normalizedToKey = new Map<string, string>();
  for (const f of existingFields) {
    normalizedToKey.set(normalizeHeader(f.key), f.key);
    normalizedToKey.set(normalizeHeader(f.name), f.key);
    for (const a of aliasesToNormalizedSet(f.aliases)) normalizedToKey.set(a, f.key);
  }
  return normalizedToKey;
}

/** 供匯入精靈：列出表頭與自動推測種類（不建立欄位） */
export function buildImportSampleRows(
  sheetRows: ImportSheetRow[],
  headers: string[],
  max = 3
): Record<string, string>[] {
  return sheetRows.slice(0, max).map((row) => {
    const o: Record<string, string> = {};
    for (const h of headers) o[h] = importCellStr(row[h]);
    return o;
  });
}

export function analyzeImportColumns(
  headers: string[],
  existingFields: FieldDefinitionLike[]
): ImportColumnAnalysis[] {
  const normalizedToKey = buildNormalizedToKeyMap(existingFields);
  const usedKeys = new Set(existingFields.map((f) => f.key));
  const out: ImportColumnAnalysis[] = [];

  for (const h of headers) {
    const nh = normalizeHeader(h);
    if (!nh) continue;

    const builtin = builtinHeaderToKey(nh);
    if (builtin) {
      out.push({ header: h, normalized: nh, kind: "core", suggestedKey: builtin });
      continue;
    }
    const mapped = normalizedToKey.get(nh);
    if (mapped) {
      out.push({ header: h, normalized: nh, kind: "existing", suggestedKey: mapped });
      continue;
    }
    let key = slugKey(h);
    if (CORE_KEYS.has(key)) key = `x_${key}`;
    let suffix = 2;
    while (usedKeys.has(key)) {
      key = `${slugKey(h)}_${suffix++}`;
    }
    usedKeys.add(key);
    out.push({ header: h, normalized: nh, kind: "new", suggestedKey: key });
  }
  return out;
}

export function buildHeaderKeyMap(
  headers: string[],
  existingFields: FieldDefinitionLike[],
  userMapping?: Record<string, ImportColumnMappingEntry> | null
): { headerToKey: Map<string, string>; newFields: NewFieldSeed[] } {
  const headerToKey = new Map<string, string>();
  const normalizedToKey = buildNormalizedToKeyMap(existingFields);
  const usedKeys = new Set(existingFields.map((f) => f.key));
  const newFields: NewFieldSeed[] = [];
  const allowedMergeKeys = new Set([
    ...CORE_KEYS,
    ...existingFields.map((f) => f.key),
  ]);

  const autoMapOne = (h: string) => {
    const nh = normalizeHeader(h);
    if (!nh) return;
    const builtin = builtinHeaderToKey(nh);
    if (builtin) {
      headerToKey.set(h, builtin);
      usedKeys.add(builtin);
      return;
    }
    const mapped = normalizedToKey.get(nh);
    if (mapped) {
      headerToKey.set(h, mapped);
      usedKeys.add(mapped);
      return;
    }
    const key = pushNewFieldFromHeader(h, nh, usedKeys, newFields);
    headerToKey.set(h, key);
  };

  if (!userMapping) {
    for (const h of headers) {
      autoMapOne(h);
    }
    return { headerToKey, newFields };
  }

  for (const h of headers) {
    const nh = normalizeHeader(h);
    if (!nh) continue;
    const decision = userMapping[h];
    if (!decision) {
      autoMapOne(h);
      continue;
    }
    if (decision.mode === "skip") {
      continue;
    }
    if (decision.mode === "merge") {
      const tk = String(decision.targetKey || "").trim();
      if (!tk || !allowedMergeKeys.has(tk)) {
        throw new Error(`invalid_merge_target:${h}:${tk}`);
      }
      headerToKey.set(h, tk);
      usedKeys.add(tk);
      continue;
    }
    if (decision.mode === "new") {
      const builtin = builtinHeaderToKey(nh);
      const mapped = normalizedToKey.get(nh);
      if (builtin || mapped) {
        throw new Error(`new_field_conflicts_with_existing:${h}:${builtin || mapped}`);
      }
      const key = pushNewFieldFromHeader(h, nh, usedKeys, newFields);
      headerToKey.set(h, key);
    }
  }

  return { headerToKey, newFields };
}

export function sheetRowsToCustomerPayloads(
  sheetRows: ImportSheetRow[],
  headerToKey: Map<string, string>,
  country: string,
  provider: string,
  importLabel: string,
  options?: { allowFilePhoneDuplicates?: boolean }
): { payloads: Array<{ rowNum: number; data: Record<string, unknown> }>; rowErrors: { rowNum: number; reason: string }[] } {
  const co = country.trim();
  const pr = provider.trim();
  const rowErrors: { rowNum: number; reason: string }[] = [];
  const payloads: Array<{ rowNum: number; data: Record<string, unknown> }> = [];

  const headers = [...headerToKey.keys()];
  const keyToHeader = new Map<string, string>();
  for (const [h, k] of headerToKey.entries()) {
    if (!keyToHeader.has(k)) keyToHeader.set(k, h);
  }

  const phoneHeader = keyToHeader.get("phone");
  if (!phoneHeader) {
    return {
      payloads: [],
      rowErrors: [{ rowNum: 1, reason: "缺少電話欄位（請包含 phone/phone number/mobile/tel 等標題）" }],
    };
  }

  const seenPhones = new Set<string>();

  for (let i = 0; i < sheetRows.length; i++) {
    const raw = sheetRows[i]!;
    const rowNum = i + 2; // header row = 1

    const phone = cellStr(raw[phoneHeader]);
    const pn = normalizePhoneDigits(phone);
    if (!pn) {
      rowErrors.push({ rowNum, reason: "電話為空或無效" });
      continue;
    }
    if (!options?.allowFilePhoneDuplicates && seenPhones.has(pn)) {
      rowErrors.push({ rowNum, reason: "檔案內電話重複" });
      continue;
    }
    seenPhones.add(pn);

    const cuid = cuidFromCountryPhone(co, phone);

    const attrs: Record<string, unknown> = {};
    const core: Record<string, unknown> = {};

    for (const h of headers) {
      const key = headerToKey.get(h);
      if (!key) continue;
      const v = raw[h];
      if (key === "phone") continue;
      if (CORE_KEYS.has(key)) {
        if (key === "age" || key === "salary") core[key] = cellNum(v);
        else core[key] = cellStr(v);
      } else {
        attrs[key] = cellStr(v);
      }
    }

    const name = String(core["name"] || "").trim();
    payloads.push({
      rowNum,
      data: {
        cuid,
        country: co,
        phone: phone.trim(),
        phoneNormalized: pn,
        provider: pr,
        name: name || "(未命名)",
        englishName: String(core["englishName"] || "").trim(),
        age: Number(core["age"] || 0),
        birthDate: String(core["birthDate"] || "").trim(),
        position: String(core["position"] || "").trim(),
        salary: Number(core["salary"] || 0),
        email: String(core["email"] || "").trim(),
        department: String(core["department"] || "").trim(),
        importRecord: importLabel,
        exportRecord: "",
        recipient: "",
        isError: false,
        attrs,
      },
    });
  }

  return { payloads, rowErrors };
}
