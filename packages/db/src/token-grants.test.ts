import { describe, expect, it } from "vitest";

import { BASE_ENTITLEMENTS } from "./entitlements";
import { applyGrantRule, applyTriggerGrants } from "./token-grants";
import type { DbTransaction } from "./transaction";

/**
 * A transaction stub that models the one behaviour these tests are about:
 * `onConflictDoNothing` returns an empty array when the rule key is already
 * claimed. `claimed` is the set of `(workspaceId, ruleKey)` already in the
 * ledger; `credits` records every balance update that actually happened.
 */
function fakeTx(claimed = new Set<string>()) {
  const credits: { workspaceId: string; tokens: number }[] = [];
  let pending: { workspaceId: string; ruleKey: string } | null = null;

  const tx = {
    insert: () => ({
      values: (row: { workspaceId: string; ruleKey: string }) => {
        pending = { workspaceId: row.workspaceId, ruleKey: row.ruleKey };
        return {
          onConflictDoNothing: () => ({
            returning: async () => {
              const key = `${pending!.workspaceId}:${pending!.ruleKey}`;
              if (claimed.has(key)) return [];
              claimed.add(key);
              return [{ id: "grant-id" }];
            },
          }),
        };
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          credits.push({
            workspaceId: pending!.workspaceId,
            tokens: "giftedRemaining" in values ? 1 : 0,
          });
        },
      }),
    }),
  } as unknown as DbTransaction;

  return { tx, credits, claimed };
}

const RULE = {
  workspaceId: "ws-1",
  ruleKey: "first_invoice_issued_v1",
  trigger: "first_invoice_issued" as const,
  tokens: 500_000,
  notify: true,
};

describe("applyGrantRule", () => {
  it("credits and reports granted on the first application", async () => {
    const { tx, credits } = fakeTx();
    const result = await applyGrantRule(tx, RULE);

    expect(result.granted).toBe(true);
    expect(result.tokens).toBe(500_000);
    expect(result.notify).toBe(true);
    expect(credits).toHaveLength(1);
  });

  it("does not credit again once the rule key is claimed", async () => {
    const { tx, credits } = fakeTx();
    await applyGrantRule(tx, RULE);
    const second = await applyGrantRule(tx, RULE);

    // The whole point of the ledger: a retried issue pays out once.
    expect(second.granted).toBe(false);
    expect(credits).toHaveLength(1);
  });

  it("does not notify for an award that was already claimed", async () => {
    const { tx } = fakeTx(new Set(["ws-1:first_invoice_issued_v1"]));
    const result = await applyGrantRule(tx, RULE);

    // Callers key the notification off `granted`, so this is what stops a
    // second congratulations email.
    expect(result.granted).toBe(false);
  });

  it("keys idempotency per workspace, not globally", async () => {
    const { tx, credits } = fakeTx();
    await applyGrantRule(tx, RULE);
    const other = await applyGrantRule(tx, { ...RULE, workspaceId: "ws-2" });

    expect(other.granted).toBe(true);
    expect(credits).toHaveLength(2);
  });
});

describe("applyTriggerGrants", () => {
  const entitlements = {
    ai: {
      ...BASE_ENTITLEMENTS.ai,
      grants: [
        {
          key: "signup_v1",
          trigger: "signup" as const,
          tokens: 250_000,
          bucket: "gifted" as const,
          notify: false,
        },
        {
          key: "first_invoice_issued_v1",
          trigger: "first_invoice_issued" as const,
          tokens: 500_000,
          bucket: "gifted" as const,
          notify: true,
        },
      ],
    },
  };

  it("applies only the rules matching the trigger", async () => {
    const { tx } = fakeTx();
    const applied = await applyTriggerGrants(tx, {
      workspaceId: "ws-1",
      entitlements,
      trigger: "first_invoice_issued",
    });

    expect(applied).toHaveLength(1);
    expect(applied[0]?.ruleKey).toBe("first_invoice_issued_v1");
  });

  it("returns nothing on a repeat, so callers stay silent", async () => {
    const { tx } = fakeTx();
    await applyTriggerGrants(tx, {
      workspaceId: "ws-1",
      entitlements,
      trigger: "first_invoice_issued",
    });
    const again = await applyTriggerGrants(tx, {
      workspaceId: "ws-1",
      entitlements,
      trigger: "first_invoice_issued",
    });

    expect(again).toEqual([]);
  });

  it("is a no-op for a sponsored plan that declares no rules", async () => {
    const { tx, credits } = fakeTx();
    const applied = await applyTriggerGrants(tx, {
      workspaceId: "ws-1",
      entitlements: { ai: { ...BASE_ENTITLEMENTS.ai, grants: [] } },
      trigger: "signup",
    });

    expect(applied).toEqual([]);
    expect(credits).toHaveLength(0);
  });
});
