import { describe, expect, it } from "vitest";

import { issuedByFooterLine, issuedByVerb } from "./labels";
import { InvoiceMetaSchema } from "./schema";

describe("issuedByVerb", () => {
  it("uses gendered Czech verbs", () => {
    expect(issuedByVerb("cs", "him")).toBe("Vystavil");
    expect(issuedByVerb("cs", "her")).toBe("Vystavila");
    expect(issuedByVerb("cs", "unspecified")).toBe("Vystavil(a)");
  });

  it("uses Issued by for every English gender", () => {
    expect(issuedByVerb("en", "him")).toBe("Issued by");
    expect(issuedByVerb("en", "her")).toBe("Issued by");
    expect(issuedByVerb("en", "unspecified")).toBe("Issued by");
  });
});

describe("issuedByFooterLine", () => {
  it("joins the verb and name", () => {
    expect(
      issuedByFooterLine("cs", { name: "Filip Ditrich", gender: "him" }),
    ).toBe("Vystavil: Filip Ditrich");
    expect(
      issuedByFooterLine("en", { name: "Filip Ditrich", gender: "her" }),
    ).toBe("Issued by: Filip Ditrich");
  });
});

describe("meta.issuedBy", () => {
  const meta = {
    docType: "invoice" as const,
    number: "20260001",
    issueDate: "2026-05-03",
    dueDate: "2026-05-17",
    duzp: "2026-05-03",
    language: "cs" as const,
    currency: "CZK" as const,
  };

  it("accepts an optional issuedBy snapshot", () => {
    const parsed = InvoiceMetaSchema.safeParse({
      ...meta,
      issuedBy: { name: "Filip Ditrich", gender: "him" },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.issuedBy).toEqual({
        name: "Filip Ditrich",
        gender: "him",
      });
    }
  });

  it("keeps meta without issuedBy valid", () => {
    const parsed = InvoiceMetaSchema.safeParse(meta);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.issuedBy).toBeUndefined();
    }
  });
});
