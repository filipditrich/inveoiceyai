import { z } from "zod";

import { decimalToMinor } from "./money-lite";

const FACTS = [
  "issuer_id",
  "supplier_id",
  "supplier_ico",
  "supplier_is_trusted",
  "supplier_is_new",
  "sender_domain",
  "doc_type",
  "currency",
  "total",
  "line_text",
  "new_beneficiary_account",
  "extraction_source",
  "has_exceptions",
] as const;

const OPS = [
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "not_in",
  "contains",
  "is",
] as const;

export const ApprovalConditionSchema = z.object({
  fact: z.enum(FACTS),
  op: z.enum(OPS),
  value: z.unknown(),
});

export const ApprovalConditionsSchema = z.object({
  version: z.literal(1),
  all: z.array(ApprovalConditionSchema).min(1),
});

export type ApprovalConditions = z.infer<typeof ApprovalConditionsSchema>;

export type ApprovalFacts = {
  issuerId?: string | null;
  supplierId?: string | null;
  supplierIco?: string | null;
  supplierIsTrusted: boolean;
  supplierIsNew: boolean;
  senderDomain?: string | null;
  docType: string;
  currency: string;
  total: string;
  lineText?: string;
  newBeneficiaryAccount: boolean;
  extractionSource: string;
  hasExceptions: boolean;
  lowConfidence: boolean;
};

export type RuleCandidate = {
  id: string;
  priority: number;
  isActive: boolean;
  conditions: unknown;
  /** The workflow path this rule assigns. */
  pathId: string | null;
  /** Tiebreak for two rules sharing a priority. */
  createdAt?: Date | string | null;
};

export function validateApprovalRuleConditions(
  conditions: unknown,
): { ok: true } | { ok: false; error: string } {
  const parsed = ApprovalConditionsSchema.safeParse(conditions);
  if (!parsed.success) {
    return { ok: false, error: "invalid_conditions" };
  }
  const comparesTotal = parsed.data.all.some((c) => c.fact === "total");
  const pinsCurrency = parsed.data.all.some(
    (c) => c.fact === "currency" && (c.op === "eq" || c.op === "in"),
  );
  if (comparesTotal && !pinsCurrency) {
    return { ok: false, error: "currency_required_for_total" };
  }
  return { ok: true };
}

function factValue(
  facts: ApprovalFacts,
  fact: (typeof FACTS)[number],
): unknown {
  switch (fact) {
    case "issuer_id":
      return facts.issuerId ?? null;
    case "supplier_id":
      return facts.supplierId ?? null;
    case "supplier_ico":
      return facts.supplierIco ?? null;
    case "supplier_is_trusted":
      return facts.supplierIsTrusted;
    case "supplier_is_new":
      return facts.supplierIsNew;
    case "sender_domain":
      return facts.senderDomain ?? null;
    case "doc_type":
      return facts.docType;
    case "currency":
      return facts.currency;
    case "total":
      return facts.total;
    case "line_text":
      return facts.lineText ?? "";
    case "new_beneficiary_account":
      return facts.newBeneficiaryAccount;
    case "extraction_source":
      return facts.extractionSource;
    case "has_exceptions":
      return facts.hasExceptions;
    default:
      return null;
  }
}

function compare(
  op: (typeof OPS)[number],
  left: unknown,
  right: unknown,
): boolean {
  if (op === "is") {
    return Boolean(left) === Boolean(right);
  }
  if (op === "in") {
    return (
      Array.isArray(right) && right.map(String).includes(String(left ?? ""))
    );
  }
  if (op === "not_in") {
    return (
      Array.isArray(right) && !right.map(String).includes(String(left ?? ""))
    );
  }
  if (op === "contains") {
    return String(left ?? "")
      .toLowerCase()
      .includes(String(right ?? "").toLowerCase());
  }
  if (op === "eq") {
    return String(left ?? "") === String(right ?? "");
  }
  if (op === "ne") {
    return String(left ?? "") !== String(right ?? "");
  }
  try {
    const l = decimalToMinor(String(left ?? "0"));
    const r = decimalToMinor(String(right ?? "0"));
    if (op === "gt") return l > r;
    if (op === "gte") return l >= r;
    if (op === "lt") return l < r;
    if (op === "lte") return l <= r;
  } catch {
    return false;
  }
  return false;
}

export function conditionsMatch(
  conditions: ApprovalConditions,
  facts: ApprovalFacts,
): boolean {
  return conditions.all.every((condition) =>
    compare(condition.op, factValue(facts, condition.fact), condition.value),
  );
}

/**
 * First active rule by ascending priority whose conditions all hold wins, with
 * `createdAt` breaking a tie. Returns the path that rule assigns; a null
 * `pathId` means the caller falls back to the workspace fallback path.
 */
export function evaluateApprovalRules(input: {
  rules: RuleCandidate[];
  facts: ApprovalFacts;
}): { ruleId: string | null; pathId: string | null } {
  const ordered = [...input.rules]
    .filter((rule) => rule.isActive)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return at - bt;
    });

  for (const rule of ordered) {
    const conditions = ApprovalConditionsSchema.safeParse(rule.conditions);
    if (!conditions.success) continue;
    if (conditionsMatch(conditions.data, input.facts)) {
      return { ruleId: rule.id, pathId: rule.pathId };
    }
  }
  return { ruleId: null, pathId: null };
}
