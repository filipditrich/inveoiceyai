import { describe, expect, it } from "vitest";

import {
  PERMISSIONS,
  PERMISSION_ENTITLEMENT,
  PRESET_PERMISSIONS,
  ROLE_PRESETS,
  presetForRole,
  resolvePermissions,
} from "./catalog";

describe("role presets", () => {
  it("gives owner everything and admin everything but workspace:manage", () => {
    expect(new Set(PRESET_PERMISSIONS.owner)).toEqual(new Set(PERMISSIONS));
    expect(PRESET_PERMISSIONS.admin).not.toContain("workspace:manage");
    // An admin runs the workspace day to day but cannot dissolve it.
    expect(PRESET_PERMISSIONS.admin).toContain("members:manage");
  });

  it("keeps the payments layer off the issuer and viewer presets", () => {
    // This is the requirement a rank check could not express: seniority and
    // access to money are orthogonal.
    for (const preset of ["issuer", "viewer"] as const) {
      expect(PRESET_PERMISSIONS[preset]).not.toContain("payments:read");
      expect(PRESET_PERMISSIONS[preset]).not.toContain("payments:manage");
      expect(PRESET_PERMISSIONS[preset]).not.toContain("bank:manage");
    }
    expect(PRESET_PERMISSIONS.accountant).toContain("payments:manage");
  });

  it("lets an issuer raise invoices but not manage clients or issuers", () => {
    expect(PRESET_PERMISSIONS.issuer).toContain("invoices:issue");
    expect(PRESET_PERMISSIONS.issuer).toContain("clients:read");
    expect(PRESET_PERMISSIONS.issuer).not.toContain("clients:manage");
    expect(PRESET_PERMISSIONS.issuer).not.toContain("issuers:manage");
  });

  it("gives viewer reads only", () => {
    for (const permission of PRESET_PERMISSIONS.viewer) {
      expect(permission.endsWith(":read")).toBe(true);
    }
  });

  it("only references permissions that exist in the catalog", () => {
    for (const preset of ROLE_PRESETS) {
      for (const permission of PRESET_PERMISSIONS[preset]) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });
});

describe("presetForRole", () => {
  it("maps Better Auth's three roles", () => {
    expect(presetForRole("owner")).toBe("owner");
    expect(presetForRole("admin")).toBe("admin");
    // An extra seat is usually somebody who raises invoices, not a passive
    // reader — so `member` maps to `issuer`, not `viewer`.
    expect(presetForRole("member")).toBe("issuer");
  });

  it("passes through a custom preset stored on the membership row", () => {
    expect(presetForRole("accountant")).toBe("accountant");
  });

  it("falls back to viewer for an unknown role rather than granting", () => {
    expect(presetForRole("wat")).toBe("viewer");
  });
});

describe("resolvePermissions", () => {
  it("returns the preset when there are no overrides", () => {
    expect(resolvePermissions("viewer")).toEqual(
      new Set(PRESET_PERMISSIONS.viewer),
    );
    expect(resolvePermissions("viewer", null)).toEqual(
      new Set(PRESET_PERMISSIONS.viewer),
    );
  });

  it("adds a granted permission on top of the preset", () => {
    const resolved = resolvePermissions("viewer", {
      grant: ["invoices:create"],
    });
    expect(resolved.has("invoices:create")).toBe(true);
    expect(resolved.has("invoices:read")).toBe(true);
  });

  it("removes a denied permission from the preset", () => {
    const resolved = resolvePermissions("accountant", {
      deny: ["payments:manage"],
    });
    expect(resolved.has("payments:manage")).toBe(false);
    expect(resolved.has("payments:read")).toBe(true);
  });

  it("lets deny win over grant for the same permission", () => {
    // An explicit "must not" is a stronger statement than an explicit "may";
    // a rule that could be widened by adding a grant elsewhere is worthless.
    const resolved = resolvePermissions("viewer", {
      grant: ["payments:manage"],
      deny: ["payments:manage"],
    });
    expect(resolved.has("payments:manage")).toBe(false);
  });

  it("cannot be escalated by an override on an unknown role", () => {
    const resolved = resolvePermissions("wat", { grant: ["invoices:read"] });
    expect(resolved.has("workspace:manage")).toBe(false);
  });
});

describe("permission → entitlement mapping", () => {
  it("ties the payments layer to the bank-connections feature", () => {
    expect(PERMISSION_ENTITLEMENT["payments:read"]).toBe(
      "features.bankConnections",
    );
    expect(PERMISSION_ENTITLEMENT["bank:manage"]).toBe(
      "features.bankConnections",
    );
  });

  it("leaves permissions with no feature gate unmapped", () => {
    // Everything else is available on every plan; only the metered or paid
    // capabilities need an entitlement behind them.
    expect(PERMISSION_ENTITLEMENT["invoices:issue"]).toBeUndefined();
    expect(PERMISSION_ENTITLEMENT["members:manage"]).toBeUndefined();
  });

  it("only maps permissions that exist", () => {
    for (const key of Object.keys(PERMISSION_ENTITLEMENT)) {
      expect(PERMISSIONS).toContain(key);
    }
  });
});
