type Condition = { fact?: unknown; op?: unknown; value?: unknown };

export type ApprovalRuleDescription = {
  /** The currency the rule pins, when it pins one. */
  currency: string | null;
  /** How many conditions the rule carries, for a one-line summary. */
  conditionCount: number;
};

export function describeApprovalRule(
  conditions: unknown,
): ApprovalRuleDescription {
  const all = Array.isArray((conditions as { all?: unknown } | null)?.all)
    ? ((conditions as { all: Condition[] }).all ?? [])
    : [];
  const currencyCondition = all.find(
    (item) => item.fact === "currency" && item.op === "eq",
  );
  return {
    currency:
      typeof currencyCondition?.value === "string"
        ? currencyCondition.value
        : null,
    conditionCount: all.length,
  };
}
