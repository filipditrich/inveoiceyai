import { describe, expect, it } from "vitest";

import { flagBool, flagString, parseArgv } from "./args";

describe("parseArgv", () => {
  it("splits command tokens from flags", () => {
    const parsed = parseArgv([
      "invoices",
      "show",
      "20260012",
      "--json",
      "--limit",
      "10",
    ]);
    expect(parsed.rest).toEqual(["invoices", "show", "20260012"]);
    expect(parsed.flags.json).toBe(true);
    expect(parsed.flags.limit).toBe("10");
  });

  it("maps -y to yes", () => {
    const parsed = parseArgv(["invoices", "issue", "20260012", "-y"]);
    expect(flagBool(parsed.flags, "yes")).toBe(true);
  });

  it("reads --output=", () => {
    const parsed = parseArgv(["invoices", "pdf", "1", "--output=./a.pdf"]);
    expect(flagString(parsed.flags, "output")).toBe("./a.pdf");
  });
});
