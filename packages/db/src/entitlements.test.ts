import { describe, expect, it } from "vitest";

import {
  BASE_ENTITLEMENTS,
  hasQuotaRoom,
  readBooleanEntitlement,
  resolveEntitlements,
} from "./entitlements";
import { PLAN_SEEDS } from "./plan-presets";

describe("resolveEntitlements", () => {
  it("returns plan defaults when there are no overrides", () => {
    expect(resolveEntitlements(BASE_ENTITLEMENTS)).toEqual(BASE_ENTITLEMENTS);
    expect(resolveEntitlements(BASE_ENTITLEMENTS, null)).toEqual(
      BASE_ENTITLEMENTS,
    );
  });

  it("merges a single key without dropping its siblings", () => {
    const resolved = resolveEntitlements(BASE_ENTITLEMENTS, {
      features: { bankConnections: true },
    });

    expect(resolved.features.bankConnections).toBe(true);
    expect(resolved.features.recurring).toBe(
      BASE_ENTITLEMENTS.features.recurring,
    );
    expect(resolved.seats).toEqual(BASE_ENTITLEMENTS.seats);
  });

  it("lets an override lift a limit to unlimited and back down", () => {
    expect(
      resolveEntitlements(BASE_ENTITLEMENTS, { seats: { max: null } }).seats
        .max,
    ).toBeNull();

    const enterprise = PLAN_SEEDS.find((plan) => plan.key === "enterprise")!;
    expect(
      resolveEntitlements(enterprise.entitlements, { seats: { max: 2 } }).seats
        .max,
    ).toBe(2);
  });

  it("replaces arrays wholesale rather than concatenating", () => {
    const plan = {
      ...BASE_ENTITLEMENTS,
      auth: { allowedEmailDomains: ["nfctron.com", "example.com"] },
    };

    // Shrinking a domain list is the more likely reason to override it, so a
    // concatenating merge would be actively wrong here.
    const resolved = resolveEntitlements(plan, {
      auth: { allowedEmailDomains: ["nfctron.com"] },
    });
    expect(resolved.auth.allowedEmailDomains).toEqual(["nfctron.com"]);

    expect(
      resolveEntitlements(plan, { auth: { allowedEmailDomains: [] } }).auth
        .allowedEmailDomains,
    ).toEqual([]);
  });

  it("ignores unknown override sections instead of leaking them through", () => {
    const resolved = resolveEntitlements(BASE_ENTITLEMENTS, {
      nonsense: { whatever: true },
    } as never);
    expect(resolved).toEqual(BASE_ENTITLEMENTS);
  });

  it("rejects a plan blob that is not a valid entitlement shape", () => {
    expect(() => resolveEntitlements({ seats: { max: "five" } })).toThrow();
    expect(() =>
      resolveEntitlements(BASE_ENTITLEMENTS, { seats: { max: -1 } }),
    ).toThrow();
  });
});

describe("plan seeds", () => {
  it("every seed is a valid entitlement shape", () => {
    for (const seed of PLAN_SEEDS) {
      expect(() => resolveEntitlements(seed.entitlements)).not.toThrow();
    }
  });

  it("has exactly one default plan", () => {
    expect(PLAN_SEEDS.filter((plan) => plan.isDefault)).toHaveLength(1);
  });

  it("keeps grant rule keys unique within a plan", () => {
    for (const seed of PLAN_SEEDS) {
      const keys = seed.entitlements.ai.grants.map((grant) => grant.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("locks the sponsored plan: managed clients, no grants, no top-up", () => {
    const nfctron = PLAN_SEEDS.find((plan) => plan.key === "nfctron")!;
    expect(nfctron.entitlements.clients.createMode).toBe("managed");
    expect(nfctron.entitlements.ai.grants).toEqual([]);
    expect(nfctron.entitlements.ai.topUpEnabled).toBe(false);
    expect(nfctron.autoAssignEmailDomains).toEqual(["nfctron.com"]);
  });
});

describe("readBooleanEntitlement", () => {
  it("reads feature flags and the top-up flag by path", () => {
    const pro = PLAN_SEEDS.find((plan) => plan.key === "pro")!.entitlements;
    expect(readBooleanEntitlement(pro, "features.bankConnections")).toBe(true);
    expect(readBooleanEntitlement(pro, "ai.topUpEnabled")).toBe(true);

    const free = PLAN_SEEDS.find((plan) => plan.key === "free")!.entitlements;
    expect(readBooleanEntitlement(free, "features.bankConnections")).toBe(
      false,
    );
  });
});

describe("hasQuotaRoom", () => {
  it("treats null as unlimited and zero as never", () => {
    expect(hasQuotaRoom(null, 9_999)).toBe(true);
    expect(hasQuotaRoom(0, 0)).toBe(false);
  });

  it("blocks only once the limit is reached, so a downgrade stays readable", () => {
    expect(hasQuotaRoom(5, 4)).toBe(true);
    expect(hasQuotaRoom(5, 5)).toBe(false);
    // Already over the limit after a downgrade: cannot grow, but nothing is
    // deleted and every existing row stays valid (ADR 0035).
    expect(hasQuotaRoom(1, 8)).toBe(false);
  });
});
