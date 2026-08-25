import { describe, expect, it } from "vitest";
import { canResendEmail } from "./email-preflight";

describe("email resend availability", () => {
  it("offers a new attempt only for recoverable delivery states", () => {
    expect(canResendEmail("failed")).toBe(true);
    expect(canResendEmail("bounced")).toBe(true);
    expect(canResendEmail("delivered")).toBe(false);
    expect(canResendEmail("queued")).toBe(false);
  });
});
