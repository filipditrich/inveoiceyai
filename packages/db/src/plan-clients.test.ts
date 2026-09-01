import { describe, expect, it } from "vitest";

import { normalizeIco } from "./clients-repo";
import { BASE_ENTITLEMENTS, resolveEntitlements } from "./entitlements";
import { PLAN_SEEDS } from "./plan-presets";

/**
 * The catalog's identity is a normalized IČO — the same key the existing
 * `clients_workspace_ico_uidx` uses. If these two ever disagree, a sync would
 * create a duplicate instead of adopting the workspace's existing row.
 */
describe("catalog identity", () => {
  it("normalizes the shapes an admin actually types", () => {
    expect(normalizeIco("123 456 78")).toBe("12345678");
    expect(normalizeIco("CZ12345678")).toBe("12345678");
    expect(normalizeIco("12345678")).toBe("12345678");
  });

  it("rejects input with no digits, which must not become a catalog key", () => {
    expect(normalizeIco("")).toBeUndefined();
    expect(normalizeIco("   ")).toBeUndefined();
    expect(normalizeIco(null)).toBeUndefined();
  });
});

describe("managed client entitlement", () => {
  it("is off by default, so no existing workspace is suddenly restricted", () => {
    expect(BASE_ENTITLEMENTS.clients.createMode).toBe("open");
  });

  it("is on for the sponsored plan and off for the builtin ones", () => {
    const mode = (key: string) =>
      PLAN_SEEDS.find((plan) => plan.key === key)!.entitlements.clients
        .createMode;

    expect(mode("nfctron")).toBe("managed");
    expect(mode("free")).toBe("open");
    expect(mode("pro")).toBe("open");
    // Enterprise ships open but is configurable — managed is a generic
    // entitlement, not an NFCtron special case (ADR 0036).
    expect(mode("enterprise")).toBe("open");
  });

  it("can be switched on for any plan through an override", () => {
    const enterprise = PLAN_SEEDS.find((plan) => plan.key === "enterprise")!;
    const resolved = resolveEntitlements(enterprise.entitlements, {
      clients: { createMode: "managed" },
    });

    expect(resolved.clients.createMode).toBe("managed");
    // The override must not disturb anything else about the plan.
    expect(resolved.seats.max).toBeNull();
    expect(resolved.features.bankConnections).toBe(true);
  });

  it("can be switched back off, so a revocation is a plain edit", () => {
    const nfctron = PLAN_SEEDS.find((plan) => plan.key === "nfctron")!;
    const resolved = resolveEntitlements(nfctron.entitlements, {
      clients: { createMode: "open" },
    });

    expect(resolved.clients.createMode).toBe("open");
  });
});
