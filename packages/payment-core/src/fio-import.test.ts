import { describe, expect, it } from "vitest";

import {
  buildFioImportXml,
  classifyFioRail,
  parseFioImportResponse,
  splitFioImportBatches,
} from "./fio-import";
import {
  isExactAutoMatchPayable,
  proposePayableMatches,
} from "./payable-matcher";
import type { NormalizedBankTransaction } from "./types";

const domesticLine = {
  amount: "1210.00",
  currency: "CZK",
  beneficiaryName: "Dodavatel & Spol.",
  beneficiaryAccountNumber: "123456789",
  beneficiaryBankCode: "0100",
  variableSymbol: "2026001",
  messageForRecipient: "Faktura <test>",
  comment: "inv/abcd1234",
  rail: "domestic" as const,
};

describe("fio import xml", () => {
  it("emits domestic before T2 and escapes text", () => {
    const { xml } = buildFioImportXml({
      accountFrom: "2000145399/2010",
      currency: "CZK",
      executionDate: "2026-08-18",
      lines: [
        {
          ...domesticLine,
          rail: "sepa",
          beneficiaryIban: "DE89370400440532013000",
          beneficiaryName: "EU Supplier",
        },
        domesticLine,
      ],
    });
    expect(xml.indexOf("DomesticTransaction")).toBeLessThan(
      xml.indexOf("T2Transaction"),
    );
    expect(xml).toContain("Dodavatel &amp; Spol.");
    expect(xml).toContain("Faktura &lt;test&gt;");
    expect(xml).toContain("<paymentType>431001</paymentType>");
    expect(xml).toContain("<paymentType>431008</paymentType>");
  });

  it("classifies rails", () => {
    expect(classifyFioRail({ accountNumber: "1", bankCode: "0100" })).toBe(
      "domestic",
    );
    expect(classifyFioRail({ iban: "DE89370400440532013000" })).toBe("sepa");
    expect(classifyFioRail({ iban: "US64SVBKUS6S3300958879" })).toBe("foreign");
  });

  it("parses every documented errorCode", () => {
    expect(
      parseFioImportResponse("<errorCode>0</errorCode><status>ok</status>").ok,
    ).toBe(true);
    expect(
      parseFioImportResponse("<errorCode>2</errorCode><status>warning</status>")
        .ok,
    ).toBe(true);
    expect(
      parseFioImportResponse("<errorCode>1</errorCode><status>error</status>")
        .ok,
    ).toBe(false);
    expect(
      parseFioImportResponse("<errorCode>11</errorCode><status>error</status>")
        .ok,
    ).toBe(false);
    expect(parseFioImportResponse("<status>fatal</status>").ok).toBe(false);
  });

  it("splits when a batch would exceed 2 MB", () => {
    const huge = Array.from({ length: 80 }, (_, index) => ({
      ...domesticLine,
      messageForRecipient: "x".repeat(140),
      comment: "y".repeat(255),
      variableSymbol: String(index).padStart(10, "0"),
    }));
    const batches = splitFioImportBatches({
      accountFrom: "1",
      currency: "CZK",
      executionDate: "2026-08-18",
      lines: huge,
    });
    expect(batches.length).toBeGreaterThanOrEqual(1);
    for (const batch of batches) {
      expect(batch.byteLength).toBeLessThanOrEqual(2 * 1024 * 1024);
    }
  });
});

describe("payable matcher", () => {
  const transaction: NormalizedBankTransaction = {
    provider: "fio",
    providerTransactionId: "1",
    providerInstructionId: null,
    bookingDate: "2026-08-18",
    amount: "1210.00",
    currency: "CZK",
    direction: "debit",
    counterpartyAccount: "CZ6508000000192000145399",
    counterpartyBankCode: "0800",
    counterpartyName: "Supplier",
    counterpartyBankName: null,
    bic: null,
    variableSymbol: "2026001",
    constantSymbol: null,
    specificSymbol: null,
    message: null,
    userIdentification: null,
    detail: null,
    comment: null,
    payerReference: null,
    providerType: "1",
    providerPayloadHash: "abc",
  };

  it("scores a submitted run line + exact VS + exact amount", () => {
    const [proposal] = proposePayableMatches({
      transaction,
      payingIban: "CZ6508000000192000145399",
      payables: [
        {
          id: "inv-1",
          supplierId: "s1",
          dueDate: "2026-08-20",
          issueDate: "2026-08-01",
          cancelledAt: null,
          status: "approved",
          total: "1210.00",
          outstanding: "1210.00",
          currency: "CZK",
          variableSymbol: "2026001",
          beneficiaryIban: "CZ6508000000192000145399",
          knownSupplierAccounts: ["CZ6508000000192000145399"],
          submittedRunLine: {
            amount: "1210.00",
            variableSymbol: "2026001",
            beneficiaryIban: "CZ6508000000192000145399",
          },
        },
      ],
    });
    expect(proposal).toBeTruthy();
    expect(proposal!.reasons).toContain("payment_run_line");
    expect(proposal!.reasons).toContain("exact_variable_symbol");
    expect(isExactAutoMatchPayable(proposal!)).toBe(true);
  });

  it("ignores credits", () => {
    expect(
      proposePayableMatches({
        transaction: { ...transaction, direction: "credit" },
        payingIban: "CZ00",
        payables: [],
      }),
    ).toEqual([]);
  });
});
