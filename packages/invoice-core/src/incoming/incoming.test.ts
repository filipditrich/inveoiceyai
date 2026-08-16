import { describe, expect, it } from "vitest";

import { renderIsdoc } from "../isdoc/render-isdoc";
import { parseIsdocAsIncoming } from "../isdoc/parse-isdoc";
import { InvoiceSchema, type Invoice } from "../schema";
import domesticFixture from "../__fixtures__/invoices/domestic-transfer.json";
import creditNoteFixture from "../__fixtures__/invoices/credit-note.json";
import { evaluateApprovalRules, validateApprovalRulePayload } from "./approval";
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

  it("rejects a total compare without a currency pin", () => {
    const result = validateApprovalRulePayload({
      conditions: {
        version: 1,
        all: [{ fact: "total", op: "gt", value: "100" }],
      },
      path: { type: "auto_approve", maxTotal: "5000", currency: "CZK" },
    });
    expect(result.ok).toBe(false);
  });

  it("auto-approves a trusted small invoice and refuses a new beneficiary", () => {
    const rules = [
      {
        id: "r1",
        priority: 1,
        isActive: true,
        conditions: {
          version: 1,
          all: [
            { fact: "currency", op: "eq", value: "CZK" },
            { fact: "supplier_is_trusted", op: "is", value: true },
          ],
        },
        path: { type: "auto_approve", maxTotal: "5000", currency: "CZK" },
      },
    ];
    const ok = evaluateApprovalRules({ rules, facts });
    expect(ok.path.type).toBe("auto_approve");
    const blocked = evaluateApprovalRules({
      rules,
      facts: { ...facts, newBeneficiaryAccount: true },
    });
    expect(blocked.path.type).toBe("fallback");
  });

  it("removes the accepting user and falls back when the path is empty", () => {
    const result = evaluateApprovalRules({
      rules: [
        {
          id: "r1",
          priority: 1,
          isActive: true,
          conditions: {
            version: 1,
            all: [{ fact: "currency", op: "eq", value: "CZK" }],
          },
          path: {
            type: "one_of",
            approvers: [{ kind: "user", id: "acceptor" }],
          },
        },
      ],
      facts,
      acceptedByUserId: "acceptor",
    });
    expect(result.path.type).toBe("fallback");
    expect(result.unreachable).toBe(true);
  });

  it("first match wins by priority", () => {
    const result = evaluateApprovalRules({
      rules: [
        {
          id: "later",
          priority: 20,
          isActive: true,
          conditions: {
            version: 1,
            all: [{ fact: "currency", op: "eq", value: "CZK" }],
          },
          path: { type: "auto_approve", maxTotal: "1", currency: "CZK" },
        },
        {
          id: "first",
          priority: 1,
          isActive: true,
          conditions: {
            version: 1,
            all: [{ fact: "currency", op: "eq", value: "CZK" }],
          },
          path: {
            type: "one_of",
            approvers: [{ kind: "role", role: "admin" }],
          },
        },
      ],
      facts,
    });
    expect(result.ruleId).toBe("first");
    expect(result.path.type).toBe("one_of");
  });
});
