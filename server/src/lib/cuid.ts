import { createHash } from "node:crypto";

/** 電話僅保留數字，國家／地區格式由匯入時的「國家」欄位決定 */
export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * CUID：由「國家 + 正規化電話」雜湊衍生。
 * 同一號碼在不同國家／地區為不同客戶（國際碼與本地格式綁定）。
 */
export function cuidFromCountryPhone(country: string, phone: string): string {
  const normCountry = country.trim().toLowerCase();
  const normPhone = normalizePhoneDigits(phone);
  const payload = `${normCountry}|${normPhone}`;
  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 22);
}
