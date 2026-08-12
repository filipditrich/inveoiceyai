import { describe, expect, it } from "vitest";

import {
  isOrganizationSlugConflict,
  slugifyWorkspaceName,
} from "./workspace-slug";

describe("slugifyWorkspaceName", () => {
  it("normalizes diacritics and punctuation", () => {
    expect(slugifyWorkspaceName("Acme s.r.o.")).toBe("acme-s-r-o");
    expect(slugifyWorkspaceName("České Faktury")).toBe("ceske-faktury");
  });

  it("falls back when empty after cleaning", () => {
    expect(slugifyWorkspaceName("!!!")).toBe("workspace");
    expect(slugifyWorkspaceName("   ")).toBe("workspace");
  });

  it("truncates long names", () => {
    const long = "a".repeat(80);
    expect(slugifyWorkspaceName(long)).toHaveLength(40);
  });
});

describe("isOrganizationSlugConflict", () => {
  it("detects Better Auth slug conflict codes", () => {
    expect(
      isOrganizationSlugConflict({
        body: { code: "ORGANIZATION_ALREADY_EXISTS" },
      }),
    ).toBe(true);
    expect(
      isOrganizationSlugConflict({
        code: "ORGANIZATION_SLUG_ALREADY_TAKEN",
      }),
    ).toBe(true);
  });

  it("detects conflict messages", () => {
    expect(
      isOrganizationSlugConflict(new Error("Organization already exists")),
    ).toBe(true);
    expect(
      isOrganizationSlugConflict({
        message: "Organization slug already taken",
      }),
    ).toBe(true);
  });

  it("does not treat unrelated failures as slug conflicts", () => {
    expect(isOrganizationSlugConflict(new Error("UNAUTHORIZED"))).toBe(false);
    expect(
      isOrganizationSlugConflict({ body: { code: "YOU_ARE_NOT_ALLOWED" } }),
    ).toBe(false);
    expect(isOrganizationSlugConflict(null)).toBe(false);
  });
});
