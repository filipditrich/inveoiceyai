import { describe, expect, it } from "vitest";

import {
  withInvoiceDraftStorage,
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

// Browser privacy policies and quota failures must not abort invoice editing or submission.
it("reports unavailable when acquiring session storage throws", () => {
  const result = withInvoiceDraftStorage(
    (local) =>
      loadRecoveredInvoiceDraft(local, {
        workspaceId: "workspace-a",
        issuerId: "issuer-a",
      }),
    () => {
      throw new DOMException("Blocked", "SecurityError");
    },
  );
  expect(result).toEqual({ available: false });
});

for (const operation of ["read", "write", "clear"] as const) {
  it(`reports unavailable when a recovery ${operation} is refused`, () => {
    const local = storage();
    const fail = () => {
      throw new DOMException(
        "Blocked",
        operation === "write" ? "QuotaExceededError" : "SecurityError",
      );
    };
    if (operation === "read") local.getItem = fail;
    if (operation === "write") local.setItem = fail;
    if (operation === "clear") local.removeItem = fail;
    const result = withInvoiceDraftStorage(
      (browserStorage) => {
        if (operation === "read")
          return loadRecoveredInvoiceDraft(browserStorage, {
            workspaceId: "workspace-a",
            issuerId: "issuer-a",
          });
        if (operation === "write")
          return saveRecoveredInvoiceDraft(browserStorage, {
            context: { workspaceId: "workspace-a", issuerId: "issuer-a" },
            value: { notes: "Private work" },
          });
        return clearRecoveredInvoiceDraft(browserStorage, "workspace-a");
      },
      () => local,
    );
    expect(result).toEqual({ available: false });
  });
}

it("keeps a recoverable draft when storage is available", () => {
  const local = storage();
  const result = withInvoiceDraftStorage(
    (browserStorage) => {
      saveRecoveredInvoiceDraft(browserStorage, {
        context: { workspaceId: "workspace-a", issuerId: "issuer-a" },
        value: { notes: "Private work" },
      });
      return loadRecoveredInvoiceDraft(browserStorage, {
        workspaceId: "workspace-a",
        issuerId: "issuer-a",
      });
    },
    () => local,
  );
  expect(result).toEqual({ available: true, value: { notes: "Private work" } });
});
