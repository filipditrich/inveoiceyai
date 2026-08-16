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

const ApproverSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), id: z.string().min(1) }),
  z.object({
    kind: z.literal("role"),
    role: z.enum(["owner", "admin", "member"]),
  }),
]);

const OneOfPathSchema = z.object({
  type: z.literal("one_of"),
  approvers: z.array(ApproverSchema).min(1),
});
const AllOfPathSchema = z.object({
  type: z.literal("all_of"),
  approvers: z.array(ApproverSchema).min(1),
});
const AutoApprovePathSchema = z.object({
  type: z.literal("auto_approve"),
  maxTotal: z.string().min(1),
  currency: z.string().min(1),
});
const SequencePathSchema = z.object({
  type: z.literal("sequence"),
  steps: z.array(OneOfPathSchema.or(AllOfPathSchema)).min(1),
});

export const ApprovalPathSchema = z.discriminatedUnion("type", [
  AutoApprovePathSchema,
  OneOfPathSchema,
  AllOfPathSchema,
  SequencePathSchema,
]);

export type ApprovalConditions = z.infer<typeof ApprovalConditionsSchema>;
export type ApprovalPath = z.infer<typeof ApprovalPathSchema>;
export type ApprovalApprover = z.infer<typeof ApproverSchema>;

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

export type EvaluatedPath =
  | { type: "auto_approve" }
  | { type: "one_of"; approvers: ApprovalApprover[] }
  | { type: "all_of"; approvers: ApprovalApprover[] }
  | {
      type: "sequence";
      steps: Array<
        | { type: "one_of"; approvers: ApprovalApprover[] }
        | { type: "all_of"; approvers: ApprovalApprover[] }
      >;
    }
  | { type: "fallback" };

export type RuleCandidate = {
  id: string;
  priority: number;
  isActive: boolean;
  conditions: unknown;
  path: unknown;
};

export function validateApprovalRulePayload(input: {
  conditions: unknown;
  path: unknown;
}): { ok: true } | { ok: false; error: string } {
  const conditions = ApprovalConditionsSchema.safeParse(input.conditions);
  if (!conditions.success) {
    return { ok: false, error: "invalid_conditions" };
  }
  const comparesTotal = conditions.data.all.some((c) => c.fact === "total");
  const pinsCurrency = conditions.data.all.some(
    (c) => c.fact === "currency" && (c.op === "eq" || c.op === "in"),
  );
  if (comparesTotal && !pinsCurrency) {
    return { ok: false, error: "currency_required_for_total" };
  }
  const path = ApprovalPathSchema.safeParse(input.path);
  if (!path.success) {
    return { ok: false, error: "invalid_path" };
  }
  if (path.data.type === "auto_approve") {
    if (!path.data.maxTotal || !path.data.currency) {
      return { ok: false, error: "auto_approve_requires_cap" };
    }
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

function stripAcceptor(
  approvers: ApprovalApprover[],
  acceptedByUserId?: string | null,
): ApprovalApprover[] {
  if (!acceptedByUserId) {
    return approvers;
  }
  return approvers.filter(
    (approver) =>
      !(approver.kind === "user" && approver.id === acceptedByUserId),
  );
}

export function evaluateApprovalRules(input: {
  rules: RuleCandidate[];
  facts: ApprovalFacts;
  acceptedByUserId?: string | null;
}): {
  ruleId: string | null;
  path: EvaluatedPath;
  unreachable: boolean;
} {
  const ordered = [...input.rules]
    .filter((rule) => rule.isActive)
    .sort((a, b) => a.priority - b.priority);

  let matched: { id: string; path: ApprovalPath } | null = null;
  for (const rule of ordered) {
    const conditions = ApprovalConditionsSchema.safeParse(rule.conditions);
    const path = ApprovalPathSchema.safeParse(rule.path);
    if (!conditions.success || !path.success) {
      continue;
    }
    if (conditionsMatch(conditions.data, input.facts)) {
      matched = { id: rule.id, path: path.data };
      break;
    }
  }

  if (!matched) {
    return { ruleId: null, path: { type: "fallback" }, unreachable: false };
  }

  const path = matched.path;
  if (path.type === "auto_approve") {
    const overCap =
      input.facts.currency !== path.currency ||
      decimalToMinor(input.facts.total) > decimalToMinor(path.maxTotal);
    const blocked =
      overCap ||
      !input.facts.supplierIsTrusted ||
      input.facts.hasExceptions ||
      input.facts.newBeneficiaryAccount ||
      (input.facts.extractionSource === "ai" && input.facts.lowConfidence);
    if (blocked) {
      return {
        ruleId: matched.id,
        path: { type: "fallback" },
        unreachable: false,
      };
    }
    return {
      ruleId: matched.id,
      path: { type: "auto_approve" },
      unreachable: false,
    };
  }

  if (path.type === "sequence") {
    const steps = path.steps.map((step) => ({
      type: step.type,
      approvers: stripAcceptor(step.approvers, input.acceptedByUserId),
    }));
    if (steps.some((step) => step.approvers.length === 0)) {
      return {
        ruleId: matched.id,
        path: { type: "fallback" },
        unreachable: true,
      };
    }
    return {
      ruleId: matched.id,
      path: { type: "sequence", steps },
      unreachable: false,
    };
  }

  const approvers = stripAcceptor(path.approvers, input.acceptedByUserId);
  if (approvers.length === 0) {
    return {
      ruleId: matched.id,
      path: { type: "fallback" },
      unreachable: true,
    };
  }
  return {
    ruleId: matched.id,
    path: { type: path.type, approvers },
    unreachable: false,
  };
}
