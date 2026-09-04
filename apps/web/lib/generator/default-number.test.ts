import { describe, expect, it } from "vitest";

import { defaultGuestInvoiceNumber } from "./default-number";

describe("defaultGuestInvoiceNumber", () => {
  it("uses the standard yearly padded template", () => {
    expect(
      defaultGuestInvoiceNumber(
        "Acme s.r.o.",
        new Date("2026-09-04T12:00:00Z"),
      ),
    ).toBe("20260001");
  });

  it("does not depend on issuer name for the default template", () => {
    expect(
      defaultGuestInvoiceNumber("Other", new Date("2026-01-01T12:00:00Z")),
    ).toBe("20260001");
  });
});
