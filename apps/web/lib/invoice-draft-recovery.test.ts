import { describe, expect, it } from "vitest";

import {
  clearRecoveredInvoiceDraft,
  consumeNewInvoiceRecoverySubmission,
  loadRecoveredInvoiceDraft,
  markNewInvoiceRecoverySubmission,
  normalizeRecoveredInvoiceBuilderDraft,
  recoveredInvoiceBuilderIssuerIsAvailable,
  saveRecoveredInvoiceDraft,
} from "./invoice-draft-recovery";

function storage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: () => null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

describe("new invoice draft recovery", () => {
  it("restores only the active workspace while retaining its selected issuer", () => {
    const local = storage();
    saveRecoveredInvoiceDraft(local, {
      context: { workspaceId: "workspace-a", issuerId: "issuer-a" },
      value: { currency: "CZK" },
    });
    expect(
      loadRecoveredInvoiceDraft(local, {
        workspaceId: "workspace-a",
        issuerId: "issuer-a",
      }),
    ).toEqual({ currency: "CZK" });
    expect(
      loadRecoveredInvoiceDraft(local, {
        workspaceId: "workspace-a",
        issuerId: "issuer-b",
      }),
    ).toEqual({ currency: "CZK" });
    expect(
      loadRecoveredInvoiceDraft(local, {
        workspaceId: "workspace-b",
        issuerId: "issuer-a",
      }),
    ).toBeNull();
  });

  it("clears a recovered draft after success or reset", () => {
    const local = storage();
    saveRecoveredInvoiceDraft(local, {
      context: { workspaceId: "workspace-a", issuerId: "issuer-a" },
      value: { currency: "CZK" },
    });
    clearRecoveredInvoiceDraft(local, "workspace-a");
    expect(
      loadRecoveredInvoiceDraft(local, {
        workspaceId: "workspace-a",
        issuerId: "issuer-a",
      }),
    ).toBeNull();
  });
});

it("clears recovery only for the matching successful create redirect", () => {
  const local = storage();
  const attempt = "00000000-0000-4000-8000-000000000001";
  markNewInvoiceRecoverySubmission(local, {
    workspaceId: "workspace-a",
    attempt,
  });

  expect(
    consumeNewInvoiceRecoverySubmission(local, {
      workspaceId: "workspace-a",
      attempt,
      successInvoiceId: "00000000-0000-4000-8000-000000000010",
      toast: "invoice_paid",
    }),
  ).toBe(false);

  markNewInvoiceRecoverySubmission(local, {
    workspaceId: "workspace-a",
    attempt,
  });
  expect(
    consumeNewInvoiceRecoverySubmission(local, {
      workspaceId: "workspace-a",
      attempt,
      successInvoiceId: "00000000-0000-4000-8000-000000000011",
      toast: "invoice_issued",
    }),
  ).toBe(true);
});

it("retains recovery after failed or unrelated invoice transitions", () => {
  const local = storage();
  const attempt = "00000000-0000-4000-8000-000000000001";
  markNewInvoiceRecoverySubmission(local, {
    workspaceId: "workspace-a",
    attempt,
  });

  expect(
    consumeNewInvoiceRecoverySubmission(local, {
      workspaceId: "workspace-a",
      attempt: null,
      successInvoiceId: "00000000-0000-4000-8000-000000000010",
      toast: "invoice_saved",
    }),
  ).toBe(false);
  expect(
    consumeNewInvoiceRecoverySubmission(local, {
      workspaceId: "workspace-a",
      attempt,
      successInvoiceId: "00000000-0000-4000-8000-000000000010",
      toast: "invoice_paid",
    }),
  ).toBe(false);
  expect(
    consumeNewInvoiceRecoverySubmission(local, {
      workspaceId: "workspace-a",
      attempt: null,
      successInvoiceId: "00000000-0000-4000-8000-000000000010",
      toast: "invoice_issued",
    }),
  ).toBe(false);
  expect(
    consumeNewInvoiceRecoverySubmission(local, {
      workspaceId: "workspace-a",
      attempt,
      successInvoiceId: "00000000-0000-4000-8000-000000000010",
      toast: "invoice_paid",
    }),
  ).toBe(false);
  expect(
    consumeNewInvoiceRecoverySubmission(local, {
      workspaceId: "workspace-a",
      attempt: "00000000-0000-4000-8000-000000000002",
      successInvoiceId: "00000000-0000-4000-8000-000000000010",
      toast: "invoice_issued",
    }),
  ).toBe(false);
  expect(
    consumeNewInvoiceRecoverySubmission(local, {
      workspaceId: "workspace-a",
      attempt,
      successInvoiceId: "00000000-0000-4000-8000-000000000010",
      toast: "invoice_saved",
    }),
  ).toBe(true);
});

it("normalizes incomplete local builder input without accepting malformed drafts", () => {
  const incomplete = {
    issuerId: "00000000-0000-4000-8000-000000000001",
    clientId: "",
    docType: "invoice",
    issueDate: "",
    dueDate: "",
    duzp: "",
    currency: "CZK",
    language: "cs",
    vatMode: "regular",
    pricesIncludeVat: false,
    suppliesAbroad: "none",
    legalNote: "",
    localReverseChargeCode: "",
    correctedInvoiceNumber: "",
    notes: "",
    items: [
      {
        description: "",
        quantity: 1,
        unit: "ks",
        unitPriceWithoutVat: 0,
        vatRate: 21,
      },
    ],
  };
  expect(normalizeRecoveredInvoiceBuilderDraft(incomplete)).toEqual(incomplete);
  expect(
    normalizeRecoveredInvoiceBuilderDraft({
      ...incomplete,
      lookId: "minimal",
      lookVersion: "1.0.0",
      accentKey: "blue",
      showStamp: false,
    }),
  ).toEqual({
    ...incomplete,
    lookId: "minimal",
    lookVersion: "1.0.0",
    accentKey: "blue",
    showStamp: false,
  });
  expect(
    normalizeRecoveredInvoiceBuilderDraft({ ...incomplete, items: "bad" }),
  ).toBeNull();
  const unknownIssuer = normalizeRecoveredInvoiceBuilderDraft({
    ...incomplete,
    issuerId: "00000000-0000-4000-8000-000000000099",
  });
  expect(unknownIssuer).not.toBeNull();
  expect(
    recoveredInvoiceBuilderIssuerIsAvailable(unknownIssuer!, [
      incomplete.issuerId,
    ]),
  ).toBe(false);
});
