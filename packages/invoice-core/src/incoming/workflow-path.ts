import { z } from "zod";

import { decimalToMinor } from "./money-lite";

/**
 * A workflow path is a named, ordered list of steps that both gates share.
 * `validation` paths run gate 1 (kontrola), `approval` paths run gate 2
 * (schválení). The machinery is identical; only who is asked and what they are
 * asked differs.
 */
export const WORKFLOW_STAGES = ["validation", "approval"] as const;
export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export const STEP_MODES = ["any_one", "all_of", "quorum"] as const;
export type WorkflowStepMode = (typeof STEP_MODES)[number];

/** Resolved per invoice at task-creation time rather than pinned to a person. */
export const DYNAMIC_APPROVERS = [
  "supplier_owner",
  "issuer_owner",
  "uploaded_by",
] as const;
export type DynamicApprover = (typeof DYNAMIC_APPROVERS)[number];

export const WORKSPACE_ROLES = ["owner", "admin", "member"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const WorkflowApproverSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), userId: z.string().min(1) }),
  z.object({ kind: z.literal("team"), teamId: z.string().min(1) }),
  z.object({ kind: z.literal("role"), role: z.enum(WORKSPACE_ROLES) }),
  z.object({ kind: z.literal("dynamic"), dynamic: z.enum(DYNAMIC_APPROVERS) }),
]);
export type WorkflowApprover = z.infer<typeof WorkflowApproverSchema>;

export const WorkflowStepSchema = z.object({
  position: z.number().int().min(1),
  mode: z.enum(STEP_MODES),
  /** Required when `mode` is `quorum`; how many approvals the step needs. */
  quorum: z.number().int().min(1).nullable().optional(),
  label: z.string().nullable().optional(),
  approvers: z.array(WorkflowApproverSchema).min(1),
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const WorkflowPathSchema = z.object({
  id: z.string().min(1),
  stage: z.enum(WORKFLOW_STAGES),
  name: z.string().min(1),
  fourEyes: z.boolean().default(true),
  autoApprove: z.boolean().default(false),
  autoApproveMaxTotal: z.string().nullable().optional(),
  autoApproveCurrency: z.string().nullable().optional(),
  steps: z.array(WorkflowStepSchema),
});
export type WorkflowPath = z.infer<typeof WorkflowPathSchema>;

/**
 * Everything the resolver needs to turn approver *references* into people.
 * Supplied by the caller so the domain stays free of database access.
 */
export type WorkflowResolutionContext = {
  /** Members of each team, by team id. */
  teamMembers: Record<string, string[]>;
  /** Members holding each role, already expanded to "at or above". */
  roleMembers: Record<WorkspaceRole, string[]>;
  /** Resolved dynamic approvers; a missing or null entry resolves to nobody. */
  dynamic: Partial<Record<DynamicApprover, string | null>>;
  /** The user who passed the previous gate; excluded when `fourEyes`. */
  excludeUserId?: string | null;
  /** Users who already approved this invoice at an earlier step. */
  alreadyApprovedUserIds?: string[];
};

export type WorkflowFacts = {
  currency: string;
  total: string;
  supplierIsTrusted: boolean;
  newBeneficiaryAccount: boolean;
  hasBlockingFindings: boolean;
  extractionSource: string;
  lowConfidence: boolean;
};

export type ResolvedStep = {
  position: number;
  mode: WorkflowStepMode;
  /** How many approvals complete the step. */
  required: number;
  assignees: string[];
};

export type ResolvedPath =
  | { kind: "auto_approve" }
  | { kind: "steps"; steps: ResolvedStep[] }
  | { kind: "fallback"; reason: FallbackReason };

export type FallbackReason =
  | "auto_approve_over_cap"
  | "auto_approve_currency_mismatch"
  | "auto_approve_supplier_untrusted"
  | "auto_approve_has_findings"
  | "auto_approve_new_account"
  | "auto_approve_low_confidence"
  | "auto_approve_missing_cap"
  | "step_unreachable"
  | "quorum_unreachable"
  | "no_steps";

/**
 * Guardrails that override whatever the path says. They are applied here, not
 * left as rules an admin has to remember to write.
 */
function autoApproveBlocker(
  path: WorkflowPath,
  facts: WorkflowFacts,
): FallbackReason | null {
  if (!path.autoApproveMaxTotal || !path.autoApproveCurrency) {
    return "auto_approve_missing_cap";
  }
  if (facts.currency !== path.autoApproveCurrency) {
    return "auto_approve_currency_mismatch";
  }
  let over = false;
  try {
    over =
      decimalToMinor(facts.total) > decimalToMinor(path.autoApproveMaxTotal);
  } catch {
    over = true;
  }
  if (over) return "auto_approve_over_cap";
  if (!facts.supplierIsTrusted) return "auto_approve_supplier_untrusted";
  if (facts.hasBlockingFindings) return "auto_approve_has_findings";
  if (facts.newBeneficiaryAccount) return "auto_approve_new_account";
  if (facts.extractionSource === "ai" && facts.lowConfidence) {
    return "auto_approve_low_confidence";
  }
  return null;
}

function expandApprovers(
  approvers: WorkflowApprover[],
  context: WorkflowResolutionContext,
): string[] {
  const out: string[] = [];
  for (const approver of approvers) {
    switch (approver.kind) {
      case "user":
        out.push(approver.userId);
        break;
      case "team":
        out.push(...(context.teamMembers[approver.teamId] ?? []));
        break;
      case "role":
        out.push(...(context.roleMembers[approver.role] ?? []));
        break;
      case "dynamic": {
        const resolved = context.dynamic[approver.dynamic];
        if (resolved) out.push(resolved);
        break;
      }
    }
  }
  return [...new Set(out)];
}

/**
 * Turns a stored path into concrete work, or says why it cannot.
 *
 * A step that resolves to nobody escalates the whole path to the workspace
 * fallback rather than silently approving — the same is true of a quorum
 * larger than the number of people who could satisfy it.
 */
export function resolveWorkflowPath(input: {
  path: WorkflowPath;
  facts: WorkflowFacts;
  context: WorkflowResolutionContext;
}): ResolvedPath {
  const { path, facts, context } = input;

  if (path.autoApprove) {
    const blocker = autoApproveBlocker(path, facts);
    return blocker
      ? { kind: "fallback", reason: blocker }
      : { kind: "auto_approve" };
  }

  if (path.steps.length === 0) {
    return { kind: "fallback", reason: "no_steps" };
  }

  const already = new Set(context.alreadyApprovedUserIds ?? []);
  const steps: ResolvedStep[] = [];

  for (const step of [...path.steps].sort((a, b) => a.position - b.position)) {
    let assignees = expandApprovers(step.approvers, context);
    if (path.fourEyes && context.excludeUserId) {
      assignees = assignees.filter((id) => id !== context.excludeUserId);
    }
    // Someone who already approved an earlier step does not approve again.
    assignees = assignees.filter((id) => !already.has(id));

    if (assignees.length === 0) {
      return { kind: "fallback", reason: "step_unreachable" };
    }

    const required =
      step.mode === "all_of"
        ? assignees.length
        : step.mode === "quorum"
          ? (step.quorum ?? 1)
          : 1;

    if (required > assignees.length) {
      return { kind: "fallback", reason: "quorum_unreachable" };
    }

    steps.push({
      position: step.position,
      mode: step.mode,
      required,
      assignees,
    });
  }

  return { kind: "steps", steps };
}

/** Save-time validation, so a broken path cannot reach the evaluator. */
export function validateWorkflowPath(
  input: unknown,
): { ok: true; path: WorkflowPath } | { ok: false; error: string } {
  const parsed = WorkflowPathSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalid_path" };
  }
  const path = parsed.data;

  if (path.autoApprove) {
    if (path.steps.length > 0) {
      return { ok: false, error: "auto_approve_with_steps" };
    }
    if (!path.autoApproveMaxTotal || !path.autoApproveCurrency) {
      return { ok: false, error: "auto_approve_requires_cap" };
    }
    return { ok: true, path };
  }

  if (path.steps.length === 0) {
    return { ok: false, error: "path_requires_steps" };
  }
  const positions = path.steps.map((step) => step.position);
  if (new Set(positions).size !== positions.length) {
    return { ok: false, error: "duplicate_step_positions" };
  }
  for (const step of path.steps) {
    if (step.mode === "quorum" && (!step.quorum || step.quorum < 1)) {
      return { ok: false, error: "quorum_requires_count" };
    }
  }
  return { ok: true, path };
}
