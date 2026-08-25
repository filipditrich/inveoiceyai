import { describe, expect, it } from "vitest";

import { renderIsdoc } from "../isdoc/render-isdoc";
import { parseIsdocAsIncoming } from "../isdoc/parse-isdoc";
import { InvoiceSchema, type Invoice } from "../schema";
import domesticFixture from "../__fixtures__/invoices/domestic-transfer.json";
import creditNoteFixture from "../__fixtures__/invoices/credit-note.json";
import {
  evaluateApprovalRules,
  validateApprovalRuleConditions,
} from "./approval";
import { resolveIdentityLink } from "./correction";
import { isValidCzIco } from "./ico";
import {
  acceptBlockingReasons,
  computeRetainUntil,
  normalizeInvoiceNumber,
  validateIncomingInvoice,
} from "./validate";

function parseInvoice(raw: unknown): Invoice {
  const parsed = InvoiceSchema.safeParse(raw);
  if (!parsed.success) {
    expect.fail(JSON.stringify(parsed.error.flatten()));
  }
  return parsed.data;
}

describe("parseIsdocAsIncoming", () => {
  it("inverts parties and fills header, VAT, and payment", () => {
    const original = parseInvoice(domesticFixture);
    const xml = renderIsdoc(original);
    const incoming = parseIsdocAsIncoming(xml);
    expect(incoming.supplier.name).toBe(original.issuer.name);
    expect(incoming.supplier.ico).toBe(original.issuer.ico);
    expect(incoming.customer.ico).toBe(original.client.ico);
    expect(incoming.header.number).toBe(original.meta.number);
    expect(incoming.header.currency).toBe(original.meta.currency);
    expect(incoming.vatBreakdown.length).toBeGreaterThan(0);
    expect(incoming.lines.length).toBe(original.items.length);
    expect(
      incoming.payment.iban || incoming.payment.accountNumber,
    ).toBeTruthy();
  });

  it("negates totals on a credit note", () => {
    const original = parseInvoice(creditNoteFixture);
    const xml = renderIsdoc(original);
    const incoming = parseIsdocAsIncoming(xml);
    expect(incoming.header.docType).toBe("credit_note");
    expect(Number(incoming.header.total)).toBeLessThan(0);
  });
});

describe("incoming validation", () => {
  it("raises missing_required_field when number is empty", () => {
    const exceptions = validateIncomingInvoice({
      supplierId: "s1",
      issueDate: "2026-01-01",
      dueDate: "2026-01-15",
      currency: "CZK",
      total: "100.00",
      paymentMethod: "cash",
    });
    expect(
      exceptions.some((item) => item.code === "missing_required_field"),
    ).toBe(true);
  });

  it("does not raise missing_required_field when accept fields are present", () => {
    const exceptions = validateIncomingInvoice({
      supplierId: "s1",
      number: "FV-1",
      issueDate: "2026-01-01",
      dueDate: "2026-01-15",
      currency: "CZK",
      total: "100.00",
      paymentMethod: "cash",
    });
    expect(
      exceptions.some((item) => item.code === "missing_required_field"),
    ).toBe(false);
  });

  it("detects duplicate, due_before_issue, invalid ico, vat mismatch, unsupported currency", () => {
    const exceptions = validateIncomingInvoice({
      supplierId: "s1",
      supplierIco: "12345678",
      number: "FV-1",
      issueDate: "2026-02-01",
      dueDate: "2026-01-01",
      currency: "USD",
      total: "100.00",
      subtotal: "50.00",
      vatTotal: "10.00",
      paymentMethod: "cash",
      duplicateOfId: "other",
    });
    const codes = exceptions.map((item) => item.code);
    expect(codes).toContain("duplicate_invoice");
    expect(codes).toContain("due_before_issue");
    expect(codes).toContain("invalid_ico");
    expect(codes).toContain("vat_mismatch");
    expect(codes).toContain("currency_unsupported");
  });

  it("accepts a valid IČO and matching VAT arithmetic", () => {
    expect(isValidCzIco("12345679")).toBe(true);
    const exceptions = validateIncomingInvoice({
      supplierId: "s1",
      supplierIco: "12345679",
      number: "fv 1",
      issueDate: "2026-01-01",
      dueDate: "2026-01-15",
      currency: "CZK",
      total: "121.00",
      subtotal: "100.00",
      vatTotal: "21.00",
      paymentMethod: "cash",
    });
    expect(exceptions.map((item) => item.code)).not.toContain("invalid_ico");
    expect(exceptions.map((item) => item.code)).not.toContain("vat_mismatch");
  });

  it("normalizes invoice numbers and retain_until", () => {
    expect(normalizeInvoiceNumber("fv-2026/1")).toBe("FV20261");
    expect(computeRetainUntil("2026-03-15", "2025-01-01")).toBe("2036-12-31");
  });

  it("blocks accept on duplicate and missing fields only", () => {
    const blocking = acceptBlockingReasons([
      { code: "duplicate_invoice" },
      { code: "vat_mismatch" },
    ]);
    expect(blocking.map((item) => item.code)).toEqual(["duplicate_invoice"]);
  });
});

describe("approval evaluator", () => {
  const facts = {
    supplierIsTrusted: true,
    supplierIsNew: false,
    docType: "invoice",
    currency: "CZK",
    total: "1000.00",
    newBeneficiaryAccount: false,
    extractionSource: "isdoc",
    hasExceptions: false,
    lowConfidence: false,
  };

  const rule = (over = {}) => ({
    id: "r1",
    priority: 1,
    isActive: true,
    conditions: {
      version: 1,
      all: [{ fact: "currency", op: "eq", value: "CZK" }],
    },
    pathId: "path-a",
    ...over,
  });

  it("rejects a total compare without a currency pin", () => {
    expect(
      validateApprovalRuleConditions({
        version: 1,
        all: [{ fact: "total", op: "gt", value: "100" }],
      }),
    ).toEqual({ ok: false, error: "currency_required_for_total" });
  });

  it("accepts a total compare that pins the currency", () => {
    expect(
      validateApprovalRuleConditions({
        version: 1,
        all: [
          { fact: "currency", op: "eq", value: "CZK" },
          { fact: "total", op: "gt", value: "100" },
        ],
      }),
    ).toEqual({ ok: true });
  });

  it("returns the path of the matching rule", () => {
    expect(evaluateApprovalRules({ rules: [rule()], facts })).toEqual({
      ruleId: "r1",
      pathId: "path-a",
    });
  });

  it("returns no path when nothing matches", () => {
    const result = evaluateApprovalRules({
      rules: [
        rule({
          conditions: {
            version: 1,
            all: [{ fact: "currency", op: "eq", value: "EUR" }],
          },
        }),
      ],
      facts,
    });
    expect(result).toEqual({ ruleId: null, pathId: null });
  });

  it("skips inactive rules", () => {
    expect(
      evaluateApprovalRules({ rules: [rule({ isActive: false })], facts }),
    ).toEqual({ ruleId: null, pathId: null });
  });

  it("skips a rule whose conditions do not parse", () => {
    expect(
      evaluateApprovalRules({
        rules: [rule({ conditions: { nope: true } })],
        facts,
      }),
    ).toEqual({ ruleId: null, pathId: null });
  });

  it("first match wins by priority", () => {
    const result = evaluateApprovalRules({
      rules: [
        rule({ id: "later", priority: 20, pathId: "path-later" }),
        rule({ id: "first", priority: 1, pathId: "path-first" }),
      ],
      facts,
    });
    expect(result).toEqual({ ruleId: "first", pathId: "path-first" });
  });

  it("breaks a priority tie by creation order", () => {
    const result = evaluateApprovalRules({
      rules: [
        rule({
          id: "newer",
          createdAt: "2026-08-02T00:00:00Z",
          pathId: "p-newer",
        }),
        rule({
          id: "older",
          createdAt: "2026-08-01T00:00:00Z",
          pathId: "p-older",
        }),
      ],
      facts,
    });
    expect(result).toEqual({ ruleId: "older", pathId: "p-older" });
  });
});

describe("resolveIdentityLink", () => {
  it("flags a duplicate when a live invoice holds the identity", () => {
    expect(
      resolveIdentityLink({
        liveDuplicate: { id: "live-1" },
        rejectedPredecessor: { id: "rejected-1", correctionRound: 0 },
      }),
    ).toEqual({
      duplicateOfId: "live-1",
      supersedesId: null,
      correctionRound: 0,
    });
  });

  it("links a correction when only a rejected invoice holds the identity", () => {
    expect(
      resolveIdentityLink({
        rejectedPredecessor: { id: "rejected-1", correctionRound: 0 },
      }),
    ).toEqual({
      duplicateOfId: null,
      supersedesId: "rejected-1",
      correctionRound: 1,
    });
  });

  it("increments the round on a second correction", () => {
    expect(
      resolveIdentityLink({
        rejectedPredecessor: { id: "rejected-2", correctionRound: 2 },
      }).correctionRound,
    ).toBe(3);
  });

  it("leaves an unseen identity unlinked", () => {
    expect(resolveIdentityLink({})).toEqual({
      duplicateOfId: null,
      supersedesId: null,
      correctionRound: 0,
    });
  });
});
