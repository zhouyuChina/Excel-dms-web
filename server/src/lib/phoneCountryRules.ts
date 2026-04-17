/**
 * 國別電話格式（與 `docs/PHONE_COUNTRY_RULES_DRAFT.md` 第一版對齊）。
 * 供列表預覽／`clean-invalid` job 共用，避免 `customers.ts` 與 runner 漂移。
 */

export function normalizePhoneDigits(phone: string): string {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  let s = raw.replace(/[()\-\s]/g, "");
  if (s.startsWith("00")) s = s.slice(2);
  if (s.startsWith("+")) s = s.slice(1);
  return s;
}

/** 供長度推估（預覽 byRule 分桶）；未辨識國別時回 null */
export function countryCodeOf(country: string): string | null {
  const c = String(country || "").trim().toLowerCase();
  if (/(taiwan|台灣|臺灣|台湾|\btw\b)/i.test(c)) return "886";
  if (/(china|中國|中国|\bcn\b)/i.test(c)) return "86";
  if (/(hong\s?kong|香港|\bhk\b)/i.test(c)) return "852";
  if (/(singapore|新加坡|\bsg\b)/i.test(c)) return "65";
  if (/(japan|日本|\bjp\b)/i.test(c)) return "81";
  if (/(usa|united states|美國|美国|\bus\b)/i.test(c)) return "1";
  if (/(canada|加拿大|\bca\b)/i.test(c)) return "1";
  if (/(korea|south korea|韓國|韩国|\bkr\b)/i.test(c)) return "82";
  if (/(australia|澳洲|\bau\b)/i.test(c)) return "61";
  if (/(malaysia|馬來西亞|马来西亚|\bmy\b)/i.test(c)) return "60";
  if (/(vietnam|越南|\bvn\b)/i.test(c)) return "84";
  if (/(philippines|菲律賓|菲律宾|\bph\b)/i.test(c)) return "63";
  return null;
}

/** 供 classifyPhoneLengthReason：國內有效號碼長度（約略）；未知國別則給寬範圍 */
export function expectedNationalLengths(country: string): number[] {
  const c = String(country || "").trim().toLowerCase();
  if (/(taiwan|台灣|臺灣|台湾|\btw\b)/i.test(c)) return [9, 10];
  if (/(china|中國|中国|\bcn\b)/i.test(c)) return [11];
  if (/(hong\s?kong|香港|\bhk\b)/i.test(c)) return [8];
  if (/(singapore|新加坡|\bsg\b)/i.test(c)) return [8];
  if (/(japan|日本|\bjp\b)/i.test(c)) return [10, 11];
  if (/(usa|united states|美國|美国|\bus\b)/i.test(c)) return [10];
  if (/(canada|加拿大|\bca\b)/i.test(c)) return [10];
  if (/(korea|south korea|韓國|韩国|\bkr\b)/i.test(c)) return [10, 11];
  if (/(australia|澳洲|\bau\b)/i.test(c)) return [9];
  if (/(malaysia|馬來西亞|马来西亚|\bmy\b)/i.test(c)) return [9, 10];
  if (/(vietnam|越南|\bvn\b)/i.test(c)) return [9, 10];
  if (/(philippines|菲律賓|菲律宾|\bph\b)/i.test(c)) return [10];
  return [7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
}

export function toNationalDigits(country: string, normalized: string): string {
  const p = String(normalized || "");
  const code = countryCodeOf(country);
  if (!code) return p;
  if (code === "1" && /^1\d{10}$/.test(p)) return p.slice(1);
  if (p.startsWith(code)) {
    const rest = p.slice(code.length);
    return rest.startsWith("0") ? rest.slice(1) : rest;
  }
  return p;
}

/**
 * C 策略：草案內列名國家走較嚴格 regex；未列名則 `^\d{7,16}$`。
 */
export function isValidPhoneByCountry(country: string, phone: string): boolean {
  const c = String(country || "").trim().toLowerCase();
  const p = normalizePhoneDigits(phone);
  if (!p) return false;

  if (/(taiwan|台灣|臺灣|台湾|\btw\b)/i.test(c)) {
    return (
      /^09\d{8}$/.test(p) ||
      /^8869\d{8}$/.test(p) ||
      /^88609\d{8}$/.test(p) ||
      /^0[2-8]\d{7,8}$/.test(p) ||
      /^886[2-8]\d{7,8}$/.test(p) ||
      /^8860[2-8]\d{7,8}$/.test(p)
    );
  }
  if (/(china|中國|中国|\bcn\b)/i.test(c)) {
    return /^1[3-9]\d{9}$/.test(p) || /^861[3-9]\d{9}$/.test(p) || /^8601[3-9]\d{9}$/.test(p);
  }
  if (/(hong\s?kong|香港|\bhk\b)/i.test(c)) {
    return /^[456789]\d{7}$/.test(p) || /^852[456789]\d{7}$/.test(p);
  }
  if (/(singapore|新加坡|\bsg\b)/i.test(c)) {
    return /^[89]\d{7}$/.test(p) || /^65[89]\d{7}$/.test(p);
  }
  if (/(japan|日本|\bjp\b)/i.test(c)) {
    return /^0\d{9,10}$/.test(p) || /^81\d{9,10}$/.test(p) || /^810\d{9,10}$/.test(p);
  }
  if (/(usa|united states|美國|美国|\bus\b)/i.test(c)) {
    return /^\d{10}$/.test(p) || /^1\d{10}$/.test(p);
  }
  if (/(canada|加拿大|\bca\b)/i.test(c)) {
    return /^\d{10}$/.test(p) || /^1\d{10}$/.test(p);
  }
  if (/(korea|south korea|韓國|韩国|\bkr\b)/i.test(c)) {
    return (
      /^01\d{8,9}$/.test(p) ||
      /^82(10|1[1-9])\d{7,8}$/.test(p) ||
      /^8201\d{8,9}$/.test(p)
    );
  }
  if (/(australia|澳洲|\bau\b)/i.test(c)) {
    return /^0[2-478]\d{8}$/.test(p) || /^61[2-478]\d{8}$/.test(p) || /^610[2-478]\d{8}$/.test(p);
  }
  if (/(malaysia|馬來西亞|马来西亚|\bmy\b)/i.test(c)) {
    return /^01\d{8,9}$/.test(p) || /^60(1\d{8,9}|[3-9]\d{7,8})$/.test(p);
  }
  if (/(vietnam|越南|\bvn\b)/i.test(c)) {
    return /^0\d{9,10}$/.test(p) || /^84\d{9,10}$/.test(p) || /^840\d{9,10}$/.test(p);
  }
  if (/(philippines|菲律賓|菲律宾|\bph\b)/i.test(c)) {
    return /^09\d{9}$/.test(p) || /^639\d{9}$/.test(p) || /^6309\d{9}$/.test(p);
  }

  return /^\d{7,16}$/.test(p);
}
