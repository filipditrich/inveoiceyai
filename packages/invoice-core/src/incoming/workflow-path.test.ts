import { describe, expect, it } from "vitest";

import {
  resolveWorkflowPath,
  validateWorkflowPath,
  type WorkflowFacts,
  type WorkflowPath,
  type WorkflowResolutionContext,
} from "./workflow-path";

const facts = (over: Partial<WorkflowFacts> = {}): WorkflowFacts => ({
  currency: "CZK",
  total: "1000.00",
  supplierIsTrusted: true,
  newBeneficiaryAccount: false,
  hasBlockingFindings: false,
  extractionSource: "isdoc",
  lowConfidence: false,
  ...over,
});

const context = (
  over: Partial<WorkflowResolutionContext> = {},
): WorkflowResolutionContext => ({
  teamMembers: { finance: ["jana", "petr"] },
  roleMembers: {
    owner: ["filip"],
    admin: ["filip", "vaclav"],
    member: ["filip", "vaclav", "ivan"],
  },
  dynamic: {},
  ...over,
});

const path = (over: Partial<WorkflowPath> = {}): WorkflowPath => ({
  id: "p1",
  stage: "approval",
  name: "Nákup",
  fourEyes: true,
  autoApprove: false,
  steps: [
    {
      position: 1,
      mode: "any_one",
      approvers: [{ kind: "team", teamId: "finance" }],
    },
  ],
  ...over,
});

describe("resolveWorkflowPath — steps", () => {
  it("expands a team into its members", () => {
    const result = resolveWorkflowPath({
      path: path(),
      facts: facts(),
      context: context(),
    });
    expect(result).toEqual({
      kind: "steps",
      steps: [
        {
          position: 1,
          mode: "any_one",
          required: 1,
          assignees: ["jana", "petr"],
          satisfied: false,
        },
      ],
    });
  });

  it("requires every assignee for all_of", () => {
    const result = resolveWorkflowPath({
      path: path({
        steps: [
          {
            position: 1,
            mode: "all_of",
            approvers: [
              { kind: "user", userId: "filip" },
              { kind: "user", userId: "vaclav" },
            ],
          },
        ],
      }),
      facts: facts(),
      context: context(),
    });
    expect(result).toMatchObject({
      steps: [{ required: 2, assignees: ["filip", "vaclav"] }],
    });
  });

  it("deduplicates a person named twice", () => {
    const result = resolveWorkflowPath({
      path: path({
        steps: [
          {
            position: 1,
            mode: "all_of",
            approvers: [
              { kind: "user", userId: "filip" },
              { kind: "role", role: "owner" },
            ],
          },
        ],
      }),
      facts: facts(),
      context: context(),
    });
    expect(result).toMatchObject({
      steps: [{ assignees: ["filip"], required: 1 }],
    });
  });

  it("orders steps by position regardless of input order", () => {
    const result = resolveWorkflowPath({
      path: path({
        steps: [
          {
            position: 2,
            mode: "any_one",
            approvers: [{ kind: "role", role: "owner" }],
          },
          {
            position: 1,
            mode: "any_one",
            approvers: [{ kind: "team", teamId: "finance" }],
          },
        ],
      }),
      facts: facts(),
      context: context(),
    });
    expect(result).toMatchObject({ steps: [{ position: 1 }, { position: 2 }] });
  });

  it("strips the person who passed the previous gate when four-eyes is on", () => {
    const result = resolveWorkflowPath({
      path: path({
        steps: [
          {
            position: 1,
            mode: "any_one",
            approvers: [{ kind: "team", teamId: "finance" }],
          },
        ],
      }),
      facts: facts(),
      context: context({ excludeUserId: "jana" }),
    });
    expect(result).toMatchObject({ steps: [{ assignees: ["petr"] }] });
  });

  it("keeps them when four-eyes is off", () => {
    const result = resolveWorkflowPath({
      path: path({ fourEyes: false }),
      facts: facts(),
      context: context({ excludeUserId: "jana" }),
    });
    expect(result).toMatchObject({ steps: [{ assignees: ["jana", "petr"] }] });
  });

  it("falls back rather than approving when four-eyes empties a step", () => {
    const result = resolveWorkflowPath({
      path: path({
        steps: [
          {
            position: 1,
            mode: "any_one",
            approvers: [{ kind: "user", userId: "jana" }],
          },
        ],
      }),
      facts: facts(),
      context: context({ excludeUserId: "jana" }),
    });
    expect(result).toEqual({ kind: "fallback", reason: "step_unreachable" });
  });

  it("marks a step satisfied when everyone on it already approved", () => {
    const result = resolveWorkflowPath({
      path: path({
        steps: [
          {
            position: 1,
            mode: "any_one",
            approvers: [{ kind: "user", userId: "jana" }],
          },
        ],
      }),
      facts: facts(),
      context: context({ alreadyApprovedUserIds: ["jana"] }),
    });
    expect(result).toMatchObject({
      kind: "steps",
      steps: [{ position: 1, satisfied: true, required: 0, assignees: [] }],
    });
  });

  it("still falls back when a step empties for any other reason", () => {
    const result = resolveWorkflowPath({
      path: path({
        steps: [
          {
            position: 1,
            mode: "any_one",
            approvers: [{ kind: "team", teamId: "empty" }],
          },
        ],
      }),
      facts: facts(),
      context: context({ teamMembers: { empty: [] } }),
    });
    expect(result).toEqual({ kind: "fallback", reason: "step_unreachable" });
  });

  it("does not ask someone to approve twice", () => {
    const result = resolveWorkflowPath({
      path: path(),
      facts: facts(),
      context: context({ alreadyApprovedUserIds: ["jana"] }),
    });
    expect(result).toMatchObject({ steps: [{ assignees: ["petr"] }] });
  });

  it("resolves a dynamic approver, and falls back when it resolves to nobody", () => {
    const withOwner = resolveWorkflowPath({
      path: path({
        steps: [
          {
            position: 1,
            mode: "any_one",
            approvers: [{ kind: "dynamic", dynamic: "supplier_owner" }],
          },
        ],
      }),
      facts: facts(),
      context: context({ dynamic: { supplier_owner: "ivan" } }),
    });
    expect(withOwner).toMatchObject({ steps: [{ assignees: ["ivan"] }] });

    const without = resolveWorkflowPath({
      path: path({
        steps: [
          {
            position: 1,
            mode: "any_one",
            approvers: [{ kind: "dynamic", dynamic: "supplier_owner" }],
          },
        ],
      }),
      facts: facts(),
      context: context({ dynamic: { supplier_owner: null } }),
    });
    expect(without).toEqual({ kind: "fallback", reason: "step_unreachable" });
  });

  it("refuses a quorum larger than the people who could satisfy it", () => {
    const result = resolveWorkflowPath({
      path: path({
        steps: [
          {
            position: 1,
            mode: "quorum",
            quorum: 3,
            approvers: [{ kind: "team", teamId: "finance" }],
          },
        ],
      }),
      facts: facts(),
      context: context(),
    });
    expect(result).toEqual({ kind: "fallback", reason: "quorum_unreachable" });
  });

  it("falls back on a path with no steps", () => {
    const result = resolveWorkflowPath({
      path: path({ steps: [] }),
      facts: facts(),
      context: context(),
    });
    expect(result).toEqual({ kind: "fallback", reason: "no_steps" });
  });
});

describe("resolveWorkflowPath — auto-approve guardrails", () => {
  const auto = (over: Partial<WorkflowPath> = {}) =>
    path({
      autoApprove: true,
      steps: [],
      autoApproveMaxTotal: "5000",
      autoApproveCurrency: "CZK",
      ...over,
    });

  it("approves under the cap", () => {
    expect(
      resolveWorkflowPath({ path: auto(), facts: facts(), context: context() }),
    ).toEqual({
      kind: "auto_approve",
    });
  });

  it.each([
    ["auto_approve_over_cap", facts({ total: "9000.00" })],
    ["auto_approve_currency_mismatch", facts({ currency: "EUR" })],
    ["auto_approve_supplier_untrusted", facts({ supplierIsTrusted: false })],
    ["auto_approve_has_findings", facts({ hasBlockingFindings: true })],
    ["auto_approve_new_account", facts({ newBeneficiaryAccount: true })],
    [
      "auto_approve_low_confidence",
      facts({ extractionSource: "ai", lowConfidence: true }),
    ],
  ])("refuses and falls back: %s", (reason, given) => {
    expect(
      resolveWorkflowPath({ path: auto(), facts: given, context: context() }),
    ).toEqual({
      kind: "fallback",
      reason,
    });
  });

  it("refuses without a cap", () => {
    expect(
      resolveWorkflowPath({
        path: auto({ autoApproveMaxTotal: null }),
        facts: facts(),
        context: context(),
      }),
    ).toEqual({ kind: "fallback", reason: "auto_approve_missing_cap" });
  });
});

describe("validateWorkflowPath", () => {
  it("accepts a well-formed path", () => {
    expect(validateWorkflowPath(path()).ok).toBe(true);
  });

  it("rejects auto-approve carrying steps", () => {
    const result = validateWorkflowPath(
      path({
        autoApprove: true,
        autoApproveMaxTotal: "1",
        autoApproveCurrency: "CZK",
      }),
    );
    expect(result).toEqual({ ok: false, error: "auto_approve_with_steps" });
  });

  it("rejects auto-approve without a cap", () => {
    expect(
      validateWorkflowPath(path({ autoApprove: true, steps: [] })),
    ).toEqual({
      ok: false,
      error: "auto_approve_requires_cap",
    });
  });

  it("rejects a manual path with no steps", () => {
    expect(validateWorkflowPath(path({ steps: [] }))).toEqual({
      ok: false,
      error: "path_requires_steps",
    });
  });

  it("rejects duplicate step positions", () => {
    const result = validateWorkflowPath(
      path({
        steps: [
          {
            position: 1,
            mode: "any_one",
            approvers: [{ kind: "role", role: "admin" }],
          },
          {
            position: 1,
            mode: "any_one",
            approvers: [{ kind: "role", role: "owner" }],
          },
        ],
      }),
    );
    expect(result).toEqual({ ok: false, error: "duplicate_step_positions" });
  });

  it("rejects a quorum step with no count", () => {
    const result = validateWorkflowPath(
      path({
        steps: [
          {
            position: 1,
            mode: "quorum",
            approvers: [{ kind: "role", role: "admin" }],
          },
        ],
      }),
    );
    expect(result).toEqual({ ok: false, error: "quorum_requires_count" });
  });

  it("rejects a step with no approvers", () => {
    expect(
      validateWorkflowPath(
        path({ steps: [{ position: 1, mode: "any_one", approvers: [] }] }),
      ),
    ).toEqual({
      ok: false,
      error: "invalid_path",
    });
  });
});
