// 定义数据结构
export interface RecordData {
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
}

export interface FilterTag {
  name: string;
  color: string;
  visible: boolean;
}

// 筛选标签配置
export const filterTagsData: FilterTag[] = [
  { name: "CUID", color: "bg-blue-500", visible: true },
  { name: "國家", color: "bg-green-500", visible: true },
  { name: "提供者", color: "bg-yellow-500", visible: true },
  { name: "電話號碼", color: "bg-purple-500", visible: true },
  { name: "姓名", color: "bg-red-500", visible: true },
  { name: "英文姓名", color: "bg-indigo-500", visible: false },
  { name: "年齡", color: "bg-pink-500", visible: false },
  { name: "出生日期", color: "bg-orange-500", visible: false },
  { name: "職位", color: "bg-teal-500", visible: false },
  { name: "薪資", color: "bg-cyan-500", visible: false },
  { name: "電子郵件", color: "bg-emerald-500", visible: false },
  { name: "部門", color: "bg-slate-500", visible: false },
  { name: "匯入紀錄", color: "bg-violet-500", visible: false },
  { name: "匯出紀錄", color: "bg-rose-500", visible: false },
  { name: "接收者", color: "bg-amber-500", visible: false },
];

// 模拟数据
export const recordsData: RecordData[] = [
  { 
    cuid: "1abc2d3e4f5g6h7i8j", 
    country: "台灣", 
    provider: "人事部", 
    phone: "0912345678", 
    name: "張三", 
    englishName: "Zhang San",
    age: 28,
    birthDate: "1995-03-15",
    position: "軟體工程師",
    salary: 65000,
    email: "zhangsan@company.com",
    department: "技術部",
    importRecord: "2024-01-15",
    exportRecord: "2024-01-20",
    recipient: "李經理",
    isError: true 
  },
  { 
    cuid: "2def3e4f5g6h7i8j9k", 
    country: "美國", 
    provider: "招聘公司", 
    phone: "0923456789", 
    name: "李四", 
    englishName: "Li Si",
    age: 32,
    birthDate: "1991-07-22",
    position: "產品經理",
    salary: 85000,
    email: "lisi@company.com",
    department: "產品部",
    importRecord: "2024-01-10",
    exportRecord: "2024-01-18",
    recipient: "王總監",
    isError: false 
  },
  { 
    cuid: "3ghi4j5k6l7m8n9o0p", 
    country: "日本", 
    provider: "分公司", 
    phone: "0934567890", 
    name: "王五", 
    englishName: "Wang Wu",
    age: 25,
    birthDate: "1998-11-08",
    position: "UI設計師",
    salary: 55000,
    email: "wangwu@company.com",
    department: "設計部",
    importRecord: "2024-01-12",
    exportRecord: "2024-01-19",
    recipient: "張主管",
    isError: true 
  },
  { 
    cuid: "4jkl5m6n7o8p9q0r1s", 
    country: "中國", 
    provider: "總公司", 
    phone: "0945678912", 
    name: "陳七", 
    englishName: "Chen Qi",
    age: 35,
    birthDate: "1988-05-30",
    position: "資深工程師",
    salary: 75000,
    email: "chenqi@company.com",
    department: "技術部",
    importRecord: "2024-01-08",
    exportRecord: "2024-01-16",
    recipient: "劉經理",
    isError: false 
  },
  { 
    cuid: "5rst6u7v8w9x0y1z2a", 
    country: "韓國", 
    provider: "外包商", 
    phone: "0945678901", 
    name: "趙六", 
    englishName: "Zhao Liu",
    age: 29,
    birthDate: "1994-09-14",
    position: "測試工程師",
    salary: 60000,
    email: "zhaoliu@company.com",
    department: "測試部",
    importRecord: "2024-01-14",
    exportRecord: "2024-01-21",
    recipient: "陳主管",
    isError: false 
  },
  { 
    cuid: "6uvw7x8y9z0a1b2c3d", 
    country: "新加坡", 
    provider: "人才市場", 
    phone: "0956789012", 
    name: "孫八", 
    englishName: "Sun Ba",
    age: 31,
    birthDate: "1992-12-03",
    position: "運營專員",
    salary: 58000,
    email: "sunba@company.com",
    department: "運營部",
    importRecord: "2024-01-11",
    exportRecord: "2024-01-17",
    recipient: "吳經理",
    isError: false 
  },
];
