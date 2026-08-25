import { describe, expect, it } from "vitest";
import { validateEmailPreflight } from "./email-preflight";

describe("email preflight", () => {
  it("blocks invalid recipients and suppressed To/Cc addresses", () => {
    expect(validateEmailPreflight("bad", "", [])).toEqual({
      valid: false,
      suppressed: false,
    });
    expect(
      validateEmailPreflight("to@example.test", "blocked@example.test", [
        "blocked@example.test",
      ]),
    ).toEqual({ valid: true, suppressed: true });
  });
  it("allows valid unsuppressed recipients", () => {
    expect(
      validateEmailPreflight(
        "to@example.test",
        "cc@example.test, second@example.test",
        [],
      ),
    ).toEqual({ valid: true, suppressed: false });
  });
});
