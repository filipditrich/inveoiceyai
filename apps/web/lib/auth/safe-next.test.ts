import { describe, expect, it } from "vitest";

import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps local application paths", () => {
    expect(safeNext("/invoices?status=overdue")).toBe(
      "/invoices?status=overdue",
    );
  });

  it.each([
    undefined,
    "",
    "https://attacker.example",
    "//attacker.example/path",
    "invoices",
    "/sign-in?next=/sign-in",
  ])("falls back for unsafe value %s", (value) => {
    expect(safeNext(value)).toBe("/dashboard");
  });
});
