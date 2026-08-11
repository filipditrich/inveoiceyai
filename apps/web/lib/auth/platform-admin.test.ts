import { describe, expect, it } from "vitest";

import { parsePlatformAdminEmails } from "./platform-admin-emails";

describe("parsePlatformAdminEmails", () => {
  it("returns empty for unset or blank", () => {
    expect(parsePlatformAdminEmails(undefined).size).toBe(0);
    expect(parsePlatformAdminEmails("").size).toBe(0);
    expect(parsePlatformAdminEmails("  ").size).toBe(0);
  });

  it("splits, trims, and lowercases", () => {
    const set = parsePlatformAdminEmails(
      " Filip.Ditrich@gmx.us , other@example.com ",
    );
    expect(set.has("filip.ditrich@gmx.us")).toBe(true);
    expect(set.has("other@example.com")).toBe(true);
    expect(set.size).toBe(2);
  });
});
