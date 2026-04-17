/// <reference types="node" />
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { cuidFromCountryPhone, normalizePhoneDigits } from "../src/lib/cuid.js";

const prisma = new PrismaClient();

async function main() {
  const resetFields = process.env.SEED_RESET_FIELDS === "1";

  if (resetFields) {
    // 測試模式：清空欄位定義與分組，確保回到乾淨基線
    await prisma.fieldDefinition.deleteMany({});
    await prisma.fieldGroup.deleteMany({});
  }

  const groups = [
    { name: "系統欄位", color: "bg-purple-500", isSystem: true, sortOrder: 0 },
    { name: "個人資訊", color: "bg-blue-500", isSystem: false, sortOrder: 1 },
    { name: "工作相關", color: "bg-green-500", isSystem: false, sortOrder: 2 },
    { name: "聯絡方式", color: "bg-orange-500", isSystem: false, sortOrder: 3 },
  ];

  const groupRows: Record<string, string> = {};
  for (const g of groups) {
    const row = await prisma.fieldGroup.upsert({
      where: { id: `seed-group-${g.name}` },
      create: { id: `seed-group-${g.name}`, ...g },
      update: { name: g.name, color: g.color, sortOrder: g.sortOrder },
    });
    groupRows[g.name] = row.id;
  }

  const fieldSeeds: Array<{
    key: string;
    name: string;
    uiColor: string;
    type: string;
    aliases?: string[];
    source?: string;
    isRequired: boolean;
    isSystem: boolean;
    defaultVisible: boolean;
    isExportable?: boolean;
    sortOrder: number;
    group: string;
  }> = [
    { key: "cuid", name: "CUID", uiColor: "bg-blue-500", type: "系統", aliases: ["cuid", "id"], source: "system", isRequired: true, isSystem: true, defaultVisible: true, isExportable: true, sortOrder: 0, group: "系統欄位" },
    { key: "country", name: "國家", uiColor: "bg-green-500", type: "系統", aliases: ["country", "國別"], source: "system", isRequired: true, isSystem: true, defaultVisible: true, isExportable: true, sortOrder: 1, group: "系統欄位" },
    { key: "provider", name: "提供者", uiColor: "bg-yellow-500", type: "系統", aliases: ["provider", "來源"], source: "system", isRequired: false, isSystem: true, defaultVisible: true, isExportable: true, sortOrder: 2, group: "系統欄位" },
    { key: "phone", name: "電話號碼", uiColor: "bg-purple-500", type: "電話", aliases: ["phone", "phone number", "mobile", "tel", "電話", "手機", "行動電話"], source: "system", isRequired: true, isSystem: true, defaultVisible: true, isExportable: true, sortOrder: 3, group: "系統欄位" },
    { key: "name", name: "姓名", uiColor: "bg-red-500", type: "中文姓名", aliases: ["name", "last name", "lastname", "中文姓名"], source: "system", isRequired: true, isSystem: false, defaultVisible: true, isExportable: true, sortOrder: 4, group: "個人資訊" },
    { key: "englishName", name: "英文姓名", uiColor: "bg-indigo-500", type: "英文姓名", aliases: ["english name", "first name", "firstname", "英文姓名"], source: "system", isRequired: false, isSystem: false, defaultVisible: false, isExportable: true, sortOrder: 5, group: "個人資訊" },
    { key: "age", name: "年齡", uiColor: "bg-pink-500", type: "數字", isRequired: true, isSystem: false, defaultVisible: false, sortOrder: 6, group: "個人資訊" },
    { key: "birthDate", name: "出生日期", uiColor: "bg-orange-500", type: "日期", isRequired: true, isSystem: false, defaultVisible: false, sortOrder: 7, group: "個人資訊" },
    { key: "position", name: "職位", uiColor: "bg-teal-500", type: "文字", isRequired: false, isSystem: false, defaultVisible: false, sortOrder: 8, group: "工作相關" },
    { key: "salary", name: "薪資", uiColor: "bg-cyan-500", type: "數字", isRequired: false, isSystem: false, defaultVisible: false, sortOrder: 9, group: "工作相關" },
    { key: "email", name: "電子郵件", uiColor: "bg-emerald-500", type: "電子郵件", aliases: ["email", "email address", "e-mail", "mail", "郵件", "電子郵件"], source: "system", isRequired: false, isSystem: false, defaultVisible: false, isExportable: true, sortOrder: 10, group: "聯絡方式" },
    { key: "department", name: "部門", uiColor: "bg-slate-500", type: "文字", isRequired: false, isSystem: false, defaultVisible: false, sortOrder: 11, group: "工作相關" },
    { key: "importRecord", name: "匯入紀錄", uiColor: "bg-violet-500", type: "文字", source: "system", isRequired: false, isSystem: true, defaultVisible: false, isExportable: true, sortOrder: 12, group: "系統欄位" },
    { key: "exportRecord", name: "匯出紀錄", uiColor: "bg-rose-500", type: "文字", source: "system", isRequired: false, isSystem: true, defaultVisible: false, isExportable: true, sortOrder: 13, group: "系統欄位" },
    { key: "recipient", name: "接收者", uiColor: "bg-amber-500", type: "文字", isRequired: false, isSystem: false, defaultVisible: false, sortOrder: 14, group: "工作相關" },
  ];

  for (const f of fieldSeeds) {
    await prisma.fieldDefinition.upsert({
      where: { key: f.key },
      create: {
        key: f.key,
        name: f.name,
        uiColor: f.uiColor,
        type: f.type,
        category: "",
        aliases: f.aliases ?? [],
        source: f.source ?? (f.isSystem ? "system" : "manual"),
        isRequired: f.isRequired,
        isSystem: f.isSystem,
        defaultVisible: f.defaultVisible,
        isExportable: f.isExportable ?? true,
        sortOrder: f.sortOrder,
        groupId: groupRows[f.group],
      },
      update: {
        name: f.name,
        uiColor: f.uiColor,
        type: f.type,
        isRequired: f.isRequired,
        isSystem: f.isSystem,
        defaultVisible: f.defaultVisible,
        aliases: f.aliases ?? [],
        source: f.source ?? (f.isSystem ? "system" : "manual"),
        isExportable: f.isExportable ?? true,
        sortOrder: f.sortOrder,
        groupId: groupRows[f.group],
      },
    });
  }

  const customerRows = [
    { country: "台灣", provider: "人事部", phone: "0912345678", name: "張三", englishName: "Zhang San", age: 28, birthDate: "1995-03-15", position: "軟體工程師", salary: 65000, email: "zhangsan@company.com", department: "技術部", importRecord: "2024-01-15", exportRecord: "2024-01-20", recipient: "李經理", isError: true },
    { country: "美國", provider: "招聘公司", phone: "+1 415-555-0199", name: "李四", englishName: "Li Si", age: 32, birthDate: "1991-07-22", position: "產品經理", salary: 85000, email: "lisi@company.com", department: "產品部", importRecord: "2024-01-10", exportRecord: "2024-01-18", recipient: "王總監", isError: false },
    { country: "日本", provider: "分公司", phone: "03-1234-5678", name: "王五", englishName: "Wang Wu", age: 25, birthDate: "1998-11-08", position: "UI設計師", salary: 55000, email: "wangwu@company.com", department: "設計部", importRecord: "2024-01-12", exportRecord: "2024-01-19", recipient: "張主管", isError: true },
    { country: "中國", provider: "總公司", phone: "13800138000", name: "陳七", englishName: "Chen Qi", age: 35, birthDate: "1988-05-30", position: "資深工程師", salary: 75000, email: "chenqi@company.com", department: "技術部", importRecord: "2024-01-08", exportRecord: "2024-01-16", recipient: "劉經理", isError: false },
    { country: "韓國", provider: "外包商", phone: "010-1234-5678", name: "趙六", englishName: "Zhao Liu", age: 29, birthDate: "1994-09-14", position: "測試工程師", salary: 60000, email: "zhaoliu@company.com", department: "測試部", importRecord: "2024-01-14", exportRecord: "2024-01-21", recipient: "陳主管", isError: false },
    { country: "新加坡", provider: "人才市場", phone: "+65 9123 4567", name: "孫八", englishName: "Sun Ba", age: 31, birthDate: "1992-12-03", position: "運營專員", salary: 58000, email: "sunba@company.com", department: "運營部", importRecord: "2024-01-11", exportRecord: "2024-01-17", recipient: "吳經理", isError: false },
  ];

  await prisma.exportJob.deleteMany({});
  await prisma.importJob.deleteMany({});
  await prisma.customer.deleteMany({});

  for (const row of customerRows) {
    const phoneNormalized = normalizePhoneDigits(row.phone);
    const cuid = cuidFromCountryPhone(row.country, row.phone);
    await prisma.customer.create({
      data: {
        cuid,
        country: row.country,
        phone: row.phone,
        phoneNormalized,
        provider: row.provider,
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
        attrs: {},
      },
    });
  }

  console.log(`seed: groups, field definitions, customers OK (resetFields=${resetFields ? "on" : "off"})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
