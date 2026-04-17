export const FIELD_PROMOTION_REVIEW_TYPE = "field-promotion-review";
export const FIELD_PROMOTION_PLAN_TYPE = "field-promotion-plan";
export const FIELD_PROMOTION_APPLY_TYPE = "field-promotion-apply";

export type FieldPromotionState =
  | "queued"
  | "rules-confirmed"
  | "pending-maintenance"
  | "scheduled-on-restart"
  | "applying"
  | "applied"
  | "failed";

export type FieldPromotionField = {
  key: string;
  name: string;
  sourceHeader: string;
  sampleValues: string[];
};

export type FieldPromotionRules = {
  type: "文字" | "數字" | "日期" | "電子郵件" | "電話";
  allowNull: boolean;
  enableFilter: boolean;
  enableSort: boolean;
  writeAliases: boolean;
  purgeAttrsAfterPromotion: boolean;
  note: string;
};

export type FieldPromotionPlan = {
  version: number;
  generatedAt: string;
  mode: "metadata-only" | "schema-and-backfill";
  fields: Array<{
    key: string;
    name: string;
    currentStorageMode: "dynamic" | "promoted";
    targetFixedColumnKey: string;
    targetFixedColumnName?: string;
    rules: FieldPromotionRules;
  }>;
  steps: string[];
  blockers: string[];
  notes: string[];
};

export type FieldPromotionPayload = {
  importJobId?: string;
  state?: FieldPromotionState;
  fields?: FieldPromotionField[];
  rules?: FieldPromotionRules;
  plan?: FieldPromotionPlan;
  scheduledForRestartAt?: string;
  lastError?: {
    summary: string;
    technicalDetail?: string;
    failedAt?: string;
  };
  cleanup?: {
    lastPreview?: unknown;
    lastApplied?: unknown;
  };
};

function asStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function asFieldPromotionState(input: unknown): FieldPromotionState {
  const state = String(input || "").trim();
  if (
    state === "queued" ||
    state === "rules-confirmed" ||
    state === "pending-maintenance" ||
    state === "scheduled-on-restart" ||
    state === "applying" ||
    state === "applied" ||
    state === "failed"
  ) {
    return state;
  }
  return "queued";
}

export function parseFieldPromotionPayload(input: unknown): FieldPromotionPayload {
  const raw =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const rulesRaw =
    raw.rules && typeof raw.rules === "object" && !Array.isArray(raw.rules)
      ? (raw.rules as Record<string, unknown>)
      : null;
  const planRaw =
    raw.plan && typeof raw.plan === "object" && !Array.isArray(raw.plan)
      ? (raw.plan as Record<string, unknown>)
      : null;
  return {
    importJobId: raw.importJobId ? String(raw.importJobId) : undefined,
    state: asFieldPromotionState(raw.state),
    fields: Array.isArray(raw.fields)
      ? raw.fields.map((field) => {
          const item =
            field && typeof field === "object" && !Array.isArray(field)
              ? (field as Record<string, unknown>)
              : {};
          return {
            key: String(item.key || ""),
            name: String(item.name || ""),
            sourceHeader: String(item.sourceHeader || ""),
            sampleValues: asStringArray(item.sampleValues),
          };
        })
      : [],
    rules: rulesRaw
      ? {
          type: (String(rulesRaw.type || "文字") as FieldPromotionRules["type"]) || "文字",
          allowNull: Boolean(rulesRaw.allowNull),
          enableFilter: Boolean(rulesRaw.enableFilter),
          enableSort: Boolean(rulesRaw.enableSort),
          writeAliases: Boolean(rulesRaw.writeAliases),
          purgeAttrsAfterPromotion: rulesRaw.purgeAttrsAfterPromotion !== false,
          note: String(rulesRaw.note || "").trim(),
        }
      : undefined,
    plan: planRaw
      ? {
          version: Number(planRaw.version || 1),
          generatedAt: String(planRaw.generatedAt || ""),
          mode:
            String(planRaw.mode || "").trim() === "schema-and-backfill"
              ? "schema-and-backfill"
              : "metadata-only",
          fields: Array.isArray(planRaw.fields)
            ? planRaw.fields.map((field) => {
                const item =
                  field && typeof field === "object" && !Array.isArray(field)
                    ? (field as Record<string, unknown>)
                    : {};
                return {
                  key: String(item.key || ""),
                  name: String(item.name || ""),
                  currentStorageMode:
                    String(item.currentStorageMode || "") === "promoted" ? "promoted" : "dynamic",
                  targetFixedColumnKey: String(item.targetFixedColumnKey || ""),
                  targetFixedColumnName: String(item.targetFixedColumnName || ""),
                  rules: {
                    type: (String(
                      (item.rules as Record<string, unknown> | undefined)?.type || "文字"
                    ) as FieldPromotionRules["type"]) || "文字",
                    allowNull: Boolean((item.rules as Record<string, unknown> | undefined)?.allowNull),
                    enableFilter: Boolean(
                      (item.rules as Record<string, unknown> | undefined)?.enableFilter
                    ),
                    enableSort: Boolean(
                      (item.rules as Record<string, unknown> | undefined)?.enableSort
                    ),
                    writeAliases: Boolean(
                      (item.rules as Record<string, unknown> | undefined)?.writeAliases
                    ),
                    purgeAttrsAfterPromotion:
                      (item.rules as Record<string, unknown> | undefined)?.purgeAttrsAfterPromotion !==
                      false,
                    note: String(
                      (item.rules as Record<string, unknown> | undefined)?.note || ""
                    ).trim(),
                  },
                };
              })
            : [],
          steps: asStringArray(planRaw.steps),
          blockers: asStringArray(planRaw.blockers),
          notes: asStringArray(planRaw.notes),
        }
      : undefined,
    scheduledForRestartAt: raw.scheduledForRestartAt
      ? String(raw.scheduledForRestartAt)
      : undefined,
    lastError:
      raw.lastError && typeof raw.lastError === "object" && !Array.isArray(raw.lastError)
        ? {
            summary: String((raw.lastError as Record<string, unknown>).summary || "").trim(),
            technicalDetail: String(
              (raw.lastError as Record<string, unknown>).technicalDetail || ""
            ).trim(),
            failedAt: String((raw.lastError as Record<string, unknown>).failedAt || "").trim(),
          }
        : undefined,
    cleanup:
      raw.cleanup && typeof raw.cleanup === "object" && !Array.isArray(raw.cleanup)
        ? {
            lastPreview: (raw.cleanup as Record<string, unknown>).lastPreview,
            lastApplied: (raw.cleanup as Record<string, unknown>).lastApplied,
          }
        : undefined,
  };
}

export function buildFieldPromotionPlan(payload: FieldPromotionPayload): FieldPromotionPlan {
  const generatedAt = new Date().toISOString();
  const rules = payload.rules;
  if (!rules) {
    throw new Error("field_promotion_rules_missing");
  }
  const fields = (payload.fields || []).filter((field) => field.key && field.name);
  if (!fields.length) {
    throw new Error("field_promotion_fields_missing");
  }
  return {
    version: 1,
    generatedAt,
    mode: "schema-and-backfill",
    fields: fields.map((field) => ({
      key: field.key,
      name: field.name,
      currentStorageMode: "dynamic",
      targetFixedColumnKey: field.key,
      targetFixedColumnName: "",
      rules,
    })),
    steps: [
      "確認固定欄位命名與 SQL migration 步驟",
      "建立固定欄位（Customer.fp_<field_key>）與索引策略",
      "回填 attrs 舊值到固定欄位",
      "切換 API / DTO / 查詢 / 匯入寫入路徑",
      "驗證完成後再決定是否清理 attrs 舊值",
    ],
    blockers: [
      "尚未切換 API / DTO / 查詢 / 匯入路徑",
    ],
    notes: [
      "apply 階段會執行 SQL 建欄與 attrs 回填",
      "attrs cleanup 仍維持人工確認後再執行",
    ],
  };
}

export function getFieldPromotionStateLabel(state: FieldPromotionState): string {
  if (state === "queued") return "待確認欄位規則";
  if (state === "rules-confirmed") return "規則已確認，準備產生升級計畫";
  if (state === "pending-maintenance") return "升級計畫已產生，待維護套用";
  if (state === "scheduled-on-restart") return "已排入下次重啟套用";
  if (state === "applying") return "固定欄位升級進行中";
  if (state === "applied") return "固定欄位升級已套用";
  return "欄位升級任務失敗";
}
