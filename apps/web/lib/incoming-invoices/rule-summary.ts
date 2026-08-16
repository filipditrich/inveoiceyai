type Condition = { fact?: unknown; op?: unknown; value?: unknown };
type Path = {
  type?: unknown;
  maxTotal?: unknown;
  currency?: unknown;
  approvers?: Array<{ kind?: unknown; role?: unknown }>;
};

export type ApprovalRuleDescription = {
  currency: string | null;
  pathType: "auto_approve" | "require_admin" | "custom";
  maxTotal: string | null;
  pathCurrency: string | null;
};

export function describeApprovalRule(
  conditions: unknown,
  path: unknown,
): ApprovalRuleDescription {
  const all = Array.isArray((conditions as { all?: unknown } | null)?.all)
    ? ((conditions as { all: Condition[] }).all ?? [])
    : [];
  const currencyCondition = all.find(
    (item) => item.fact === "currency" && item.op === "eq",
  );
  const currency =
    typeof currencyCondition?.value === "string"
      ? currencyCondition.value
      : null;

  const parsed = path as Path | null;
  if (parsed?.type === "auto_approve") {
    return {
      currency,
      pathType: "auto_approve",
      maxTotal: typeof parsed.maxTotal === "string" ? parsed.maxTotal : null,
      pathCurrency:
        typeof parsed.currency === "string" ? parsed.currency : null,
    };
  }
  const adminOnly =
    parsed?.type === "one_of" &&
    Array.isArray(parsed.approvers) &&
    parsed.approvers.length === 1 &&
    parsed.approvers[0]?.kind === "role" &&
    parsed.approvers[0]?.role === "admin";
  if (adminOnly) {
    return {
      currency,
      pathType: "require_admin",
      maxTotal: null,
      pathCurrency: null,
    };
  }
  return {
    currency,
    pathType: "custom",
    maxTotal: null,
    pathCurrency: null,
  };
}
