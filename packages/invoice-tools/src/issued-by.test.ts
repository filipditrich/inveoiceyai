import { describe, expect, it } from "vitest";

import type { Invoice } from "@invoicey/invoice-core/schema";

import { issuedByFromProfile, withIssuedBy } from "./issued-by";

const invoice = {
  meta: {
    docType: "invoice",
    number: "20260001",
    issueDate: "2026-05-03",
    dueDate: "2026-05-17",
    duzp: "2026-05-03",
    language: "cs",
    currency: "CZK",
  },
} as Invoice;

describe("issuedByFromProfile", () => {
  it("returns null for a blank name", () => {
    expect(issuedByFromProfile({ name: "  ", gender: "him" })).toBeNull();
  });

  it("defaults unknown gender to unspecified", () => {
    expect(
      issuedByFromProfile({ name: "Ada Lovelace", gender: "nope" }),
    ).toEqual({ name: "Ada Lovelace", gender: "unspecified" });
  });
});

describe("withIssuedBy", () => {
  it("leaves the invoice unchanged when snapshot is missing", () => {
    expect(withIssuedBy(invoice, null).meta.issuedBy).toBeUndefined();
  });

  it("stamps meta.issuedBy", () => {
    const next = withIssuedBy(invoice, {
      name: "Ada Lovelace",
      gender: "her",
    });
    expect(next.meta.issuedBy).toEqual({
      name: "Ada Lovelace",
      gender: "her",
    });
  });
});
