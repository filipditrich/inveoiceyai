import { describe, expect, it } from "vitest";

import { snapshotString } from "./snapshot";

describe("snapshotString", () => {
  it("reads identity fields from a jsonb-shaped object", () => {
    const snap = { name: "Acme", ico: "12345678", dic: "CZ12345678" };
    expect(snapshotString(snap, "name")).toBe("Acme");
    expect(snapshotString(snap, "ico")).toBe("12345678");
    expect(snapshotString(snap, "dic")).toBe("CZ12345678");
  });

  it("returns null for missing, empty, or non-object values", () => {
    expect(snapshotString(null, "name")).toBeNull();
    expect(snapshotString({ name: "" }, "name")).toBeNull();
    expect(snapshotString({ name: 12 }, "name")).toBeNull();
  });
});
