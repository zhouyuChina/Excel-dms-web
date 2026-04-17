# 預設欄位帶入邏輯

本文件整理目前系統中「預設值帶入」的實際行為，方便後續調整 UI / 規格時對照。

---

## A) 匯入欄位預設對應（Header Mapping）

檔案位置：`server/src/lib/importSpreadsheet.ts`

本段是你關心的重點：例如「`first name` 為何會帶入英文姓名」、「`last name` 為何會帶入姓名」。

### A-1. 對應優先序（由高到低）

匯入時每個表頭會依序嘗試：

1. **內建規則**（`builtinHeaderToKey`，最高優先）
2. **欄位定義比對**（`FieldDefinition` 的 `key` / `name` / `aliases`）
3. **建立新動態欄位**（寫進 `attrs`）

> 也就是說：只要命中內建規則，就不會再往下走別名比對。

### A-2. 表頭正規化規則（比對前統一格式）

`normalizeHeader()` 會先把表頭做標準化：

- 轉小寫
- 去前後空白
- `_` / `-` 轉空白
- 移除括號與特殊符號
- 多空白壓成一個空白
- 嘗試修復常見亂碼（mojibake）

例如：

- `First_Name` -> `first name`
- `PHONE-NUMBER` -> `phone number`
- `電話(含國碼)` -> `電話 含國碼`

### A-3. 內建預設對應清單（完整）

#### 姓名相關

- `first name` / `firstname` -> `englishName`（英文姓名）
- `last name` / `lastname` -> `name`（姓名）
- `姓名` / `中文姓名` / `名字` / `名稱` / `聯絡人` -> `name`
- `英文姓名` / `英文名` / `英文名字` / `english name` -> `englishName`

#### 電話相關

以下任一命中 -> `phone`：

- `phone`
- `phone number`
- `mobile phone`
- `mobilephone`
- `mobile`
- `tel`
- `telephone`
- `cell`
- `電話`
- `电话`
- `手機`
- `手机`
- `電話號碼`
- `电话号码`
- `聯絡電話`
- `联系电话`
- `行動電話`
- `手機號碼`
- `手机号`
- `手机号码`

此外還有「包含式容錯」：

- 若正規化後包含 `phone/mobile/telephone/tel` 且不含 `email` -> `phone`
- 若正規化後包含 `電話/电话/手機/手机` 且不含 `郵件/邮件` -> `phone`

#### 其他核心欄位（含簡體常用詞）

- `email` / `email address` / `e mail` / `電子郵件` / `郵件` / `信箱` -> `email`
- `department` / `部門` / `部门` / `部別` / `單位` / `单位` / `組別` / `组织` -> `department`
- `position` / `title` / `職位` / `职位` / `職稱` / `职称` / `崗位` / `岗位` -> `position`
- `age` / `年齡` / `年龄` / `歲` / `岁` -> `age`
- `birth` / `birth date` / `birthday` / `出生日期` / `生日` / `出生年月日` -> `birthDate`
- `salary` / `薪資` / `薪资` / `薪水` / `工資` / `工资` / `月薪` / `年薪` -> `salary`

### A-4. 欄位定義（FieldDefinition）比對規則

若沒命中內建規則，會拿正規化後表頭去比對現有欄位：

- `field.key`
- `field.name`
- `field.aliases[]`

以上都會先經過同一套 `normalizeHeader()` 再比對。

### A-5. 對不到時怎麼處理

若內建 + 欄位定義都對不到：

- 會自動建立新欄位（`source=import`）
- 新欄位 key 由表頭 slug 化（`slugKey`）產生
- 寫入 `newFields` 並落到 `attrs`
- 預設 `defaultVisible=true`、`isExportable=true`

### A-6. 核心保留 key（避免衝突）

以下 key 視為核心欄位，不會拿來當新動態欄位 key：

- `phone`
- `name`
- `englishName`
- `email`
- `department`
- `position`
- `age`
- `birthDate`
- `salary`

若 slug 後撞到核心 key，會自動改成 `x_<key>`（例如 `x_name`）。

## 1) 匯入彈窗（設定匯入資料）

檔案位置：`src/components/business/data-management/components/modals/ImportModal.tsx`

### 帶入時機

- 開啟匯入彈窗時
- 或重新開啟同一彈窗時（會重置成預設）

### 欄位預設規則

- `country`（國家）
  - 預設取 `countries[0]`
  - 若清單為空，預設為空字串
- `provider`（資料提供者）
  - 預設為「自訂提供者」模式（`__CUSTOM__`）
- `customProvider`（自訂提供者輸入框）
  - state 初始為空字串
  - UI 顯示時若空值，會顯示「檔名（不含副檔名）」作為預設建議

### 送出前最終值規則

- 若目前是自訂提供者模式：
  - `providerFinal = customProvider || fileBaseName`
- 若目前是既有提供者模式：
  - `providerFinal = provider`

> 也就是說：自訂模式下若使用者沒手動輸入，會自動落檔名（去副檔名）作為 provider。

### 風險提醒（已實作）

- 國家欄位下方會顯示提醒：
  - 「請務必正確填寫國家；此欄位會影響後續電話格式驗證與清理判定結果。」

---

## 2) 資料表欄位顯示（欄位標籤可見性）

檔案位置：`src/components/business/data-management/DataManagementPage.tsx`

### 帶入時機

- 頁面初始化呼叫 `refreshFieldDefsAndMeta()`
- 重新整理欄位定義後

### 欄位可見預設規則

1. 先讀後端欄位定義（`fetchFieldDefinitions`），依 `sortOrder` 排序。
2. 僅保留 `isExportable !== false` 的欄位作為前端可操作欄位。
3. 若 API 回傳中至少有一個 `defaultVisible = true`：
   - 直接採用各欄位 `defaultVisible`。
4. 若 API 回傳沒有任何欄位標記為可見：
   - 套用前端 fallback 可見欄位：
   - `cuid`, `country`, `provider`, `phone`, `name`

> 這段邏輯是為了避免欄位設定不完整時，頁面整張表變成全隱藏。

---

## 3) 目前優先序總結

- **匯入彈窗**
  - 使用者手動輸入 > 預設建議值
- **資料表欄位可見性**
  - 後端 `defaultVisible` > 前端 fallback 清單

---

## 4) 若要調整建議

- 若希望匯入時 `provider` 預設先選清單第一筆，而非自訂模式：
  - 調整 `provider` 初始值由 `__CUSTOM__` 改為 `providers[0] || __CUSTOM__`
- 若希望強制國家不可空：
  - 維持現有送出前驗證（已存在），也可再加 UI 紅字必填標示
- 若要讓資料表初始欄位更精簡：
  - 調整 fallback keys（目前是 5 欄）
- 若要調整「表頭對應」：
  - 優先改 `builtinHeaderToKey()`（影響全局）
  - 再補 `seed.ts` 的 `aliases`（可配置、可維運）

