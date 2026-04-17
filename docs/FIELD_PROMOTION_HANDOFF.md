# 欄位升級計畫交接

本文提供給下一個視窗/下一位助理，說明目前「匯入新欄位 -> 欄位升級任務 -> 使用者補規則」這條線已做到哪裡、還缺哪裡，以及建議的後續實作順序。

## 0. 給下一個視窗的最短摘要

若只是要快速接手，先記這幾點：

1. 這輪完成的是**欄位升級前置治理流程**，不是最終 promotion。
2. 匯入前必須先解析欄位，使用者要決定每個表頭是：
   - 併入既有欄位
   - 新增動態欄位
   - 不匯入
3. 若某表頭其實可對應既有欄位，前後端都會禁止再新增重複動態欄位。
4. 匯入出現新欄位時，會自動建立 `field-promotion` 任務。
5. 使用者可在任務中心或欄位管理頁右側側欄填寫升級規則。
6. 規則存好後，會先進入「待維護套用」。
7. 使用者現在可逐任務按「下次重啟套用」，任務會進入 `scheduled-on-restart`。
8. API / worker 重啟時會依建立時間排序，把 `scheduled-on-restart` 任務依序放行執行。
9. restart apply runner 目前會執行 SQL：建立 `Customer.fp_<field_key>` 固定欄位、依規則建立索引、回填 `attrs[key]`，成功後任務會進入 `applied`。
10. **但 API / DTO / 查詢 / 匯入寫入路徑尚未全面切到固定欄位。**

若要延續這條線，下一步優先做：

1. 補完真正的 DB 固定欄位升級（套用 runner 已可建欄／索引／回填；見 `FIELD_PROMOTION_MIGRATION.md`）。
2. ~~定義動態 Prisma schema / migration 產物如何產生與回滾~~ → **已文件化**：[`FIELD_PROMOTION_MIGRATION.md`](./FIELD_PROMOTION_MIGRATION.md)（runtime DDL、版本化 SQL、Prisma 靜態化三層策略與回滾語意）。
3. 把 API / DTO / 查詢 / 匯入寫入路徑切到 promoted column。
4. 最後再做 `attrs` cleanup confirmation 與 validation report。

---

## 1. 目前已完成什麼

### 1.1 匯入流程：先解析、再確認、再匯入

目前匯入不允許直接略過欄位對照。

- `ImportModal` 必須先按「解析檔案欄位」
- 後端 `POST /api/imports/analyze` 會回傳：
  - `headers`
  - `columns`：`core / existing / new`
  - `suggestedKey`
  - `samples`
  - `mergeTargets`
- 使用者確認 mapping 後，前端才可送 `POST /api/imports`
- `POST /api/imports` 現在要求 `columnMapping` 必填
- 後端也會驗證至少有一欄對應到 `phone`

目前這段使用者流程可理解成：

1. 上傳檔案
2. 解析表頭與樣本列
3. 系統先做自動對照建議
4. 使用者逐欄確認：
   - 併入既有欄位
   - 新增動態欄位
   - 不匯入
5. 確認 mapping 後才真正建立匯入 job

### 1.2 新增動態欄位的限制

已改成「能併入的就不能新增」。

- 若某表頭可辨識成 `core` 或 `existing`
  - 前端下拉不再出現「新增動態欄位」
  - 只允許：
    - `併入既有欄位`
    - `不匯入`
- 後端 `buildHeaderKeyMap()` 也加了防護
  - 若使用者硬送 `mode: "new"` 但該欄其實可對應既有欄位
  - 會直接拒絕：`new_field_conflicts_with_existing`

### 1.3 這段匯入治理目前的核心決策

這些是目前已定案、下一個視窗應該延續的原則：

1. **匯入前分析是必經流程**
   - 不走「先匯入再清理」那條路
   - 避免先寫進 `attrs`，事後再刪造成語意混亂
2. **系統可以先自動建議，但最後決策權在使用者**
   - 可以貼心，不可以靜默替使用者決定
3. **可併入既有欄位時，不允許再建立語意重複的新動態欄位**
4. **新欄位先以動態欄位承接，再透過 `field-promotion` 進入後續治理**
5. **欄位升級規則先收集，真正 promotion 後做**

### 1.4 匯入後自動建立欄位升級任務

若本次匯入存在 `newFields`，系統會額外建立一筆 `field-promotion` 任務。

- 任務 source：`field-promotion`
- 任務 payload 目前包含：
  - `importJobId`
  - `fields`
    - `key`
    - `name`
    - `sourceHeader`
    - `sampleValues`

### 1.5 任務中心已可處理欄位升級任務

已完成：

- `TaskCenterPage` 可篩選 `field-promotion`
- 對 `queued` 的欄位升級任務可按「設定規則」
- 可開 dialog 填規則：
  - 欄位型別
  - 允許空值
  - 升級後允許篩選
  - 升級後允許排序
  - 記住這次的欄位名稱，之後自動對應
  - 升級完成後，移除舊的自訂欄資料，避免重複保存
  - 備註
- 儲存後目前會：
  - 把規則寫回 `jobQueue.payload.rules`
  - 將該任務標成 `completed`
  - subtitle 改成：`已確認規則，待維護套用固定欄位`

### 1.6 欄位管理頁右側已加入「待升級欄位」側欄

`FieldManagementPage` 現在右側有側欄，可直接看到 `field-promotion` 任務。

已完成：

- 側欄列出欄位升級任務
- 顯示狀態：
  - `待確認`
  - `已確認`
  - `失敗`
  - `處理中`
- 可直接從欄位管理頁開啟同一套規則 dialog

### 1.7 Header 任務中心下拉已針對欄位升級任務做特殊顯示

避免 `field-promotion` 被當成一般批次任務顯示出奇怪的進度。

已完成：

- `field-promotion` 不再顯示進度條與 `0/1`
- 改顯示文字：
  - `待確認欄位規則`
  - `規則已確認，待維護套用`
  - `欄位升級任務失敗`
  - `欄位升級處理中`

### 1.8 Dialog 樣式與文案

已完成：

- 通用 `Dialog` 加上圓角 `rounded-2xl`
- 匯入 modal 上方的國家 / 提供者 / 自訂提供者 UI 已重整
- 匯入與升級規則中的文案已改成白話

### 1.9 仍未落地、但已有方向的項目

下列是當初匯入對照規劃中有提、但目前仍未實作的部分：

- 記住對照範本
- 併入時自動寫回 `FieldDefinition.aliases`
- 依 provider / 檔案 hash / 使用者維度保存 mapping 模板
- 多檔共用暫存 ID

這些都屬於「讓重複匯入更省步驟」的優化，不影響目前主流程可運作。

---

## 2. 目前做到哪一步，還沒做到哪一步

### 已做到

可以把現在理解成：

1. 匯入時新欄位先以動態欄位承接
2. 系統自動產生欄位升級任務
3. 使用者在任務中心 / 欄位管理頁補完規則
4. 任務被標記為「待維護套用固定欄位」

### 還沒做到

**真正的固定欄位升級尚未落地。**

目前還沒有實作：

1. 在資料庫 `Customer` 上真正新增固定欄位
2. 自動/半自動改 Prisma schema
3. 舊資料從 `attrs[key]` 回填到固定欄
4. `toDTO()` / API / 查詢 / 匯入路徑切換到新固定欄
5. 清掉 `attrs` 舊值
6. 將欄位升級任務從「待確認」變成真正可執行的升級工作

因此：

- 現在填好規則後，可由使用者逐任務「排入下次重啟套用」，重啟時會依序執行 SQL 升級
- 目前只是把升級規則蒐集完

---

## 3. 目前的技術實作位置

### 匯入與欄位對照

- `server/src/lib/importSpreadsheet.ts`
  - `analyzeImportColumns()`
  - `buildHeaderKeyMap()`
- `server/src/routes/imports.ts`
  - `POST /api/imports/analyze`
  - `POST /api/imports`
- `server/src/lib/importJobRunner.ts`
  - 讀 `ImportJob.columnMapping`

### 欄位升級任務

- `server/src/routes/imports.ts`
  - 匯入時建立 `field-promotion` 任務
- `server/src/lib/jobQueue.ts`
  - 支援 `field-promotion`
  - 但 `claimNextQueuedJob()` 目前故意不執行它
- `server/src/routes/jobs.ts`
  - `GET /api/jobs/field-promotion/:jobId`
  - `POST /api/jobs/field-promotion/:jobId`

### 前端 UI

- `src/components/business/data-management/components/modals/ImportModal.tsx`
  - 匯入精靈
- `src/components/business/tasks/TaskCenterPage.tsx`
  - 任務中心規則 dialog
- `src/components/business/field/FieldManagementPage.tsx`
  - 右側待升級欄位側欄
- `src/components/layout/Header.tsx`
  - 右上角任務中心下拉特殊顯示

---

## 4. 得到了什麼

### 產品面

1. 使用者不再能把「其實可併入既有欄位」的表頭亂建成新欄位
2. 新欄位不再只是默默進 `attrs`，而是有治理入口
3. 使用者可以先回答「這欄未來要怎麼升級」的規則
4. 欄位管理頁開始承接「欄位治理」角色，而不只是欄位 CRUD

### 工程面

1. 已有欄位升級任務資料模型雛形
2. 規則輸入介面已存在，可作為後續 migration/promotion 的正式輸入
3. 前後端都已把 `field-promotion` 視為與匯入/匯出不同類型的任務

### 4.1 這條線的已知風險與注意點

1. **表頭很多時，人工確認成本仍高**
   - 目前已有自動建議，但尚未做到記住範本與 aliases 回寫
2. **表頭誤併風險仍存在**
   - 所以目前維持「系統建議 + 使用者最後確認」的模式
3. **worker 與匯入對照的競態問題目前已靠 payload 鎖定避免**
   - 對照結果在入隊前就固定，worker 只讀最終 mapping
4. **多語表頭 / 同義詞命中率未來仍需靠 aliases 與正規化持續優化**

---

## 5. 下一步建議：真正實作固定欄位升級

建議不要一口氣做到「自動改 Prisma schema + 自動重啟」，而是拆三階段。

### Phase A：先做 promotion plan 與執行器

目標：讓規則確認後，能產生一份可執行計畫。

建議新增：

- `field-promotion-runner.ts`
- `jobQueue` 新狀態或新 source/type
  - 例如：
    - `field-promotion-plan`
    - `field-promotion-apply`

任務內容應包含：

- 欄位 key
- 欄位型別
- 是否索引 / 是否排序
- 是否保留 attrs
- 是否寫 aliases
- note

### Phase B：先做「不改 DB schema」的 promotion 模擬

先把風險高的部分拆開，不要第一版就碰 migration。

可以先做：

1. promotion 任務完成後
2. 在 `FieldDefinition` 上加狀態，例如：
   - `storageMode = dynamic | pending_promotion | promoted`
3. 顯示在欄位管理頁

這樣先把治理狀態完整做出來。

### Phase C：真的做固定欄位升級

這是最重的一段，目前完全未做。

需要定義：

1. 如何新增固定欄位
   - 現狀是 Prisma schema 靜態
   - 真正自動 promotion 代表要動 schema
2. 如何回填 `attrs[key] -> 固定欄`
3. 如何切查詢與 DTO
4. 如何刪除/保留舊 attrs 值
5. 是否需要重啟 API

---

## 6. 關鍵設計提醒

### 6.1 「重啟套用」與 migration 文案

**現況**：已支援「排入下次重啟」後由 API/worker 啟動時排佇並執行套用（DDL／索引／回填）；細節與 **正式 migration 策略** 見 [`FIELD_PROMOTION_MIGRATION.md`](./FIELD_PROMOTION_MIGRATION.md)。

**對外文案**：若環境尚未完成讀寫路徑切換，仍建議以「待維護套用／維護窗」為主，避免過度承諾「重啟即完成全產品行為」；技術上重啟確實會觸發已排程之套用 job。

### 6.2 `attrs` 清理要放在最後

使用者目前可勾：

- `升級完成後，移除舊的自訂欄資料，避免重複保存`

但真實執行順序建議是：

1. 建固定欄
2. 回填資料
3. 切 API / DTO / 匯入寫入路徑
4. 驗證成功
5. 最後再清 `attrs`

也就是：

- **對外 API 最終不保留 attrs**
- 但內部 migration 過程建議保留短暫過渡期

### 6.3 `phone` 仍是特殊核心欄位

目前 `phone` 仍影響：

- `cuid`
- 重複判定
- 國家電話驗證

所以 promotion 邏輯未來若碰到 `phone` 類欄位，不能和一般欄位等量齊觀。

---

## 7. 建議下一個視窗優先做什麼

若下一個視窗要延續，建議照這個順序：

1. **先文件化 promotion 狀態流**
   - queued
   - rules-confirmed
   - pending-maintenance
   - applied
   - failed
2. **新增 `FieldDefinition` 的 promotion 狀態欄位**
3. **做 promotion plan runner**
   - 先只寫計畫，不碰 schema
4. **再決定是否要真的自動化固定欄位**

若下一個視窗直接想衝「真的固定欄位升級」，要先回答：

- schema 要怎麼改？
- 是用 Prisma migration、`db push`、還是 SQL runner？
- 重啟點在哪？
- 回填失敗怎麼 rollback？

---

## 8. 目前系統一句話總結

**現在已完成「新欄位匯入治理 + 欄位升級任務 + 使用者補規則 + 套用時建立 `fp_*`／索引／回填」；讀寫路徑與正式 migration 產物收斂仍待補齊（見 `FIELD_PROMOTION_MIGRATION.md`）。**

---

## 9. attrs cleanup（B：人工確認）操作步驟

適用條件：`field-promotion` 任務狀態已是 `applied`。

1. 在任務中心或欄位管理頁打開該任務詳情。
2. 先按「預覽 attrs 清理」取得統計：
   - `totalWithAttr`：attrs 目前仍有舊值的筆數
   - `matchedPromoted`：可安全移除（與固定欄一致）
   - `mismatch`：不一致，需人工檢查
   - `missingPromoted`：固定欄仍缺值
3. 若 `mismatch > 0`，UI 會顯示紅色警示並鎖住「確認清理 attrs」按鈕。
4. 僅當 `mismatch = 0` 時，才可按「確認清理 attrs」。
5. 套用後會回寫清理結果（移除筆數）到任務 detail，供後續稽核。

安全邏輯（後端）：

- 只會刪除符合以下任一條件的 attrs 舊值：
  - `attrs[key]` 為空值
  - `attrs[key]` 與 `fp_*` 固定欄位值一致
- 不一致資料（`mismatch`）不會被自動刪除。

