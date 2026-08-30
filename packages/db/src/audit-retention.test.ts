import { describe, expect, it } from "vitest";

import { BASE_ENTITLEMENTS, resolveEntitlements } from "./entitlements";
import { PLAN_SEEDS } from "./plan-presets";

/**
 * `pruneAuditEvents` itself needs a database, so what is worth pinning here is
 * the decision it turns on: which plans have a finite retention at all, and
 * that "keep forever" stays `null` rather than degrading into a large number.
 */
describe("audit retention entitlement", () => {
  const retention = (key: string) =>
    PLAN_SEEDS.find((plan) => plan.key === key)!.entitlements.audit
      .retentionDays;

  it("keeps Enterprise forever, expressed as null", () => {
    // Not a big number: a constant would silently start deleting Enterprise
    // history the day someone lowered it.
    expect(retention("enterprise")).toBeNull();
  });

  it("gives the paid tiers a year and Free a month", () => {
    expect(retention("free")).toBe(30);
    expect(retention("pro")).toBe(365);
    expect(retention("nfctron")).toBe(365);
  });

  it("lets an override lift a workspace to keep-forever", () => {
    const free = PLAN_SEEDS.find((plan) => plan.key === "free")!;
    const resolved = resolveEntitlements(free.entitlements, {
      audit: { retentionDays: null },
    });
    expect(resolved.audit.retentionDays).toBeNull();
  });

  it("rejects a nonsensical retention rather than pruning everything", () => {
    // A zero or negative window would delete the entire audit log on the next
    // sweep, so the schema refuses it outright.
    expect(() =>
      resolveEntitlements(BASE_ENTITLEMENTS, { audit: { retentionDays: 0 } }),
    ).toThrow();
    expect(() =>
      resolveEntitlements(BASE_ENTITLEMENTS, { audit: { retentionDays: -1 } }),
    ).toThrow();
  });
});
