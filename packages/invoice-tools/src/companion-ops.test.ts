import { describe, expect, it } from "vitest";

import { CompanionRequestSchema } from "./companion-schema";
import { looksLikeUuid, sanitizeSearch } from "./invoice-ref";

describe("looksLikeUuid", () => {
  it("accepts a canonical uuid", () => {
    expect(looksLikeUuid("2c1f1a3e-4b0d-4c8a-9f11-7a0c0d1e2f30")).toBe(true);
  });

  it("rejects an invoice number", () => {
    expect(looksLikeUuid("20260012")).toBe(false);
  });
});

describe("sanitizeSearch", () => {
  it("strips ilike wildcards", () => {
    expect(sanitizeSearch("  %NFCtron_  ")).toBe("NFCtron");
  });
});

describe("CompanionRequestSchema", () => {
  it("parses invoices.get", () => {
    const parsed = CompanionRequestSchema.parse({
      op: "invoices.get",
      ref: "20260012",
    });
    expect(parsed.op).toBe("invoices.get");
  });

  it("requires a client on create", () => {
    const parsed = CompanionRequestSchema.parse({
      op: "invoices.create",
      ico: "27082440",
      draft: {
        items: [
          {
            description: "Consulting",
            quantity: 8,
            unit: "h",
            unitPriceWithoutVat: 1800,
            vatRate: 21,
          },
        ],
      },
    });
    expect(parsed.op).toBe("invoices.create");
  });

  it("rejects an unknown op", () => {
    const parsed = CompanionRequestSchema.safeParse({ op: "looks.build" });
    expect(parsed.success).toBe(false);
  });
});
