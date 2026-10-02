import { describe, expect, it } from "vitest";

import { BASE_ENTITLEMENTS, resolveEntitlements } from "./entitlements";

describe("audit retention policy", () => {
  it.each([null, 366, 1000])(
    "caps legacy stored retention %s at one year",
    (retentionDays) => {
      expect(
        resolveEntitlements({ ...BASE_ENTITLEMENTS, audit: { retentionDays } })
          .audit.retentionDays,
      ).toBe(365);
    },
  );
  it("prevents workspace overrides from bypassing the cap", () => {
    expect(
      resolveEntitlements(BASE_ENTITLEMENTS, { audit: { retentionDays: null } })
        .audit.retentionDays,
    ).toBe(365);
  });
  it("preserves shorter retention for a workspace", () => {
    expect(
      resolveEntitlements(BASE_ENTITLEMENTS, { audit: { retentionDays: 14 } })
        .audit.retentionDays,
    ).toBe(14);
  });
  it.each([0, -1])("rejects unsafe retention %s", (retentionDays) => {
    expect(() =>
      resolveEntitlements(BASE_ENTITLEMENTS, { audit: { retentionDays } }),
    ).toThrow();
  });
});
