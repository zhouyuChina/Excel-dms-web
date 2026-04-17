# 下一個視窗提示詞

請先不要重跑需求探索，直接延續目前「匯入欄位對照 + `field-promotion` 任務 + 欄位升級規則收集」這條線。

## 先讀文件

請依這個順序閱讀：

1. `docs/FIELD_PROMOTION_HANDOFF.md`
2. `docs/CRM_MASTER_BRIEF.md`
3. `docs/FIELD_MANAGEMENT_REFACTOR.md`

## 目前已完成的事

1. 匯入前必須先解析欄位。
2. 使用者需逐欄決定：
   - `併入既有欄位`
   - `新增動態欄位`
   - `不匯入`
3. 若表頭其實可對應既有欄位，前後端都禁止再新增重複動態欄位。
4. 匯入出現新欄位時，會自動建立 `field-promotion` 任務。
5. 使用者可在任務中心或欄位管理頁右側側欄填寫升級規則。
6. Header 任務中心已把 `field-promotion` 視為非進度型任務，不該顯示 `0/1` 或其他進度條。

## 非常重要：目前還沒做的事

目前**還沒有**做真正的固定欄位升級：

1. 沒有自動新增 DB 固定欄位
2. 沒有 Prisma schema / migration promotion
3. 沒有 `attrs[key] -> 固定欄` 回填
4. 沒有 API / DTO / 查詢 / 匯入路徑切換
5. 沒有正式清理舊 `attrs`

所以：

- **現在填好規則後，重啟前後端不會自動升級**
- 現在做完的只是「規則收集 + 待維護套用」

## 這條線的核心原則

1. 匯入前分析是必經流程，不走「先匯入再清理」。
2. 系統可以先建議，但最後決定權一定在使用者。
3. 可併入既有欄位時，不允許再建立語意重複的新動態欄位。
4. 新欄位先以動態欄位承接，再透過 `field-promotion` 進入治理。
5. promotion 規則先收集，真正 promotion 之後再做。

## 目前建議你優先做的事

1. 正式化 `field-promotion` 任務狀態流
   - 例如：`queued -> rules-confirmed -> pending-maintenance -> applied / failed`
2. 為 `FieldDefinition` 增加 promotion 相關狀態欄位
3. 做 promotion plan / apply runner
   - 第一版先做計畫，不要一開始就碰 schema migration
4. 再決定真正固定欄位升級策略
   - Prisma migration / SQL runner / rollback / restart timing

## 若你要直接開始實作，先回答這些問題

1. 固定欄位要真的改 Prisma schema，還是先做 metadata promotion？
2. migration 誰產生？什麼時機執行？
3. 回填失敗怎麼 rollback？
4. `attrs` 舊值什麼時候清？
5. promotion 完成前，API 要不要同時讀固定欄與 `attrs`？

## 目前一句話總結

**這輪已完成「新欄位匯入治理 + 欄位升級任務 + 規則收集」；尚未完成「動態欄位正式升級為 DB 固定欄位」。**

