import type { PrismaClient } from "@prisma/client";

export function businessUniqueKey(country: string, phoneNormalized: string): string {
  return `${String(country || "").trim().toLowerCase()}|${String(phoneNormalized || "").trim()}`;
}

export function collectDuplicateRowsByBusinessKey(
  rows: Array<{ rowNum: number; country: string; phoneNormalized: string }>
): number[] {
  const seen = new Set<string>();
  const duplicateRows: number[] = [];
  for (const row of rows) {
    const key = businessUniqueKey(row.country, row.phoneNormalized);
    if (seen.has(key)) duplicateRows.push(row.rowNum);
    seen.add(key);
  }
  return duplicateRows.sort((a, b) => a - b);
}

export async function buildCountryPhoneKeySet(
  prisma: PrismaClient,
  country: string
): Promise<Set<string>> {
  const keySet = new Set<string>();
  const dbRows = await prisma.customer.findMany({
    where: { country },
    select: { country: true, phoneNormalized: true },
  });
  for (const row of dbRows) {
    keySet.add(businessUniqueKey(row.country, row.phoneNormalized));
  }
  return keySet;
}
