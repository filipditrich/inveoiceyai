import { describe, expect, it } from "vitest";

import {
  buildFioPeriodsUrl,
  fetchFioTransactions,
  isValidFioTokenShape,
  parseFioResponse,
} from "./fio";
import {
  derivePaymentState,
  isExactAutoMatchProposal,
  proposeInvoiceMatches,
} from "./matcher";
import {
  extractMonetaPaymentSymbols,
  fetchMonetaTransactions,
  isValidMonetaTokenShape,
  listMonetaAccounts,
  normalizeMonetaTransaction,
  parseMonetaAccountsResponse,
} from "./moneta";
import type { NormalizedBankTransaction } from "./types";

const transaction: NormalizedBankTransaction = {
  provider: "fio",
  providerTransactionId: "123",
  providerInstructionId: "456",
  bookingDate: "2026-08-15",
  amount: "1210.00",
  currency: "CZK",
  direction: "credit",
  counterpartyAccount: "123456789/0100",
  counterpartyBankCode: "0100",
  counterpartyName: "Client",
  counterpartyBankName: "KB",
  bic: null,
  variableSymbol: "20260001",
  constantSymbol: null,
  specificSymbol: null,
  message: "Invoice",
  userIdentification: null,
  detail: null,
  comment: null,
  payerReference: null,
  providerType: "Příjem",
  providerPayloadHash: "hash",
};

describe("parseFioResponse", () => {
  it("normalizes sparse JSON and preserves symbols", () => {
    const result = parseFioResponse({
      accountStatement: {
        info: {
          accountId: "123456789",
          bankId: "2010",
          currency: "CZK",
          iban: "CZ0020100000000123456789",
          bic: "FIOBCZPPXXX",
          openingBalance: 10,
          closingBalance: 20,
          dateStart: "2026-08-15+02:00",
          dateEnd: "2026-08-15+02:00",
        },
        transactionList: {
          transaction: {
            column22: { value: 123, id: 22 },
            column0: { value: "2026-08-15+02:00", id: 0 },
            column1: { value: 10.5, id: 1 },
            column14: { value: "CZK", id: 14 },
            column5: { value: "000123", id: 5 },
            column8: { value: "Příjem", id: 8 },
          },
        },
      },
    });
    expect(result.account.accountNumber).toBe("123456789/2010");
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({
      amount: "10.50",
      direction: "credit",
      variableSymbol: "000123",
    });
  });

  it("accepts an empty transaction list", () => {
    const result = parseFioResponse({
      accountStatement: {
        info: {
          accountId: "123456789",
          bankId: "2010",
          currency: "CZK",
          iban: "CZ0020100000000123456789",
          bic: "FIOBCZPPXXX",
        },
        transactionList: null,
      },
    });
    expect(result.transactions).toEqual([]);
  });

  it("fails closed when a required movement field disappears", () => {
    expect(() =>
      parseFioResponse({
        accountStatement: {
          info: {
            accountId: "123456789",
            bankId: "2010",
            currency: "CZK",
            iban: "CZ0020100000000123456789",
            bic: "FIOBCZPPXXX",
          },
          transactionList: {
            transaction: {
              column0: { value: "2026-08-15+02:00" },
              column1: { value: 10 },
              column14: { value: "CZK" },
              column22: { value: 1 },
            },
          },
        },
      }),
    ).toThrow("fio_missing_type");
  });

  it("maps provider throttling without exposing the token", async () => {
    await expect(
      fetchFioTransactions({
        token: "a".repeat(64),
        from: "2026-08-15",
        to: "2026-08-15",
        fetchImpl: async () => new Response(null, { status: 409 }),
      }),
    ).rejects.toThrow("fio_throttled");
  });
});

describe("Fio token shape", () => {
  it("accepts any non-whitespace 64-character provider token", () => {
    const token = `${"a".repeat(63)}/`;
    expect(isValidFioTokenShape(token)).toBe(true);
    expect(
      buildFioPeriodsUrl({
        token,
        from: "2026-08-15",
        to: "2026-08-15",
      }),
    ).toContain(`${"a".repeat(63)}%2F/2026-08-15`);
  });

  it("rejects the wrong length or embedded whitespace", () => {
    expect(isValidFioTokenShape("a".repeat(63))).toBe(false);
    expect(isValidFioTokenShape(`${"a".repeat(31)} ${"b".repeat(32)}`)).toBe(
      false,
    );
  });
});

describe("Moneta VIP AISP adapter", () => {
  it("parses accounts and builds CZ account numbers from IBAN", () => {
    const accounts = parseMonetaAccountsResponse({
      accounts: [
        {
          id: "acc-1",
          nameI18N: "Běžný účet",
          currency: "CZK",
          identification: { iban: "CZ6508000000192000145399" },
          servicer: {
            bankCode: "0800",
            bic: "GIBACZPX",
            countryCode: "CZ",
          },
        },
      ],
      pageNumber: 0,
      pageCount: 1,
    });
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      provider: "moneta",
      providerAccountId: "acc-1",
      iban: "CZ6508000000192000145399",
      bankCode: "0800",
      currency: "CZK",
      accountNumber: "192000145399/0800",
    });
  });

  it("extracts VS/KS/SS from creditor reference and normalizes CRDT", () => {
    expect(extractMonetaPaymentSymbols("VS:123456 KS:0308 SS:0001")).toEqual({
      variableSymbol: "123456",
      constantSymbol: "0308",
      specificSymbol: "0001",
    });
    const tx = normalizeMonetaTransaction({
      entryReference: "trx-1",
      status: "BOOK",
      creditDebitIndicator: "CRDT",
      amount: { currency: "CZK", value: 101.5 },
      bookingDate: { date: "2026-08-01" },
      entryDetails: {
        transactionDetails: {
          remittanceInformation: {
            structured: {
              creditorReferenceInformation: {
                reference: "VS:123456 KS:0308 SS:0001",
              },
            },
          },
          references: {
            transactionDescription: "Platba faktury",
          },
        },
      },
    });
    expect(tx).toMatchObject({
      provider: "moneta",
      providerTransactionId: "trx-1",
      amount: "101.50",
      direction: "credit",
      variableSymbol: "123456",
      constantSymbol: "0308",
      specificSymbol: "0001",
      message: "Platba faktury",
    });
  });

  it("pages through transactions and maps unauthorized without exposing the token", async () => {
    let calls = 0;
    const batch = await fetchMonetaTransactions({
      token: "m".repeat(32),
      accountId: "acc-1",
      from: "2026-08-01",
      to: "2026-08-15",
      account: {
        provider: "moneta",
        providerAccountId: "acc-1",
        accountNumber: "1/0600",
        bankCode: "0600",
        iban: "CZ0006000000000000000001",
        bic: "AGBACZPP",
        currency: "CZK",
        openingBalance: null,
        closingBalance: null,
      },
      fetchImpl: async (input) => {
        calls += 1;
        const url = String(input);
        expect(url).toContain("fromDate=2026-08-01");
        expect(url).toContain("toDate=2026-08-15");
        if (url.includes("pageNumber=0")) {
          return Response.json({
            transactions: [
              {
                entryReference: "trx-a",
                status: "BOOK",
                creditDebitIndicator: "CRDT",
                amount: { currency: "CZK", value: 10 },
                bookingDate: { date: "2026-08-02" },
              },
            ],
            pageNumber: 0,
            pageCount: 2,
          });
        }
        return Response.json({
          transactions: [
            {
              entryReference: "trx-b",
              status: "BOOK",
              creditDebitIndicator: "DBIT",
              amount: { currency: "CZK", value: 5 },
              bookingDate: { date: "2026-08-03" },
            },
          ],
          pageNumber: 1,
          pageCount: 2,
        });
      },
    });
    expect(calls).toBe(2);
    expect(batch.transactions.map((row) => row.providerTransactionId)).toEqual([
      "trx-a",
      "trx-b",
    ]);
    expect(batch.transactions[1]?.direction).toBe("debit");

    await expect(
      listMonetaAccounts({
        token: "m".repeat(32),
        fetchImpl: async () => new Response(null, { status: 401 }),
      }),
    ).rejects.toThrow("moneta_unauthorized");
  });

  it("validates token shape", () => {
    expect(isValidMonetaTokenShape("m".repeat(32))).toBe(true);
    expect(isValidMonetaTokenShape("short")).toBe(false);
    expect(isValidMonetaTokenShape(`${"m".repeat(16)} ${"n".repeat(16)}`)).toBe(
      false,
    );
  });
});

describe("proposeInvoiceMatches", () => {
  it("produces a high exact VS and amount match", () => {
    const result = proposeInvoiceMatches({
      transaction,
      receivingIban: "CZ0020100000000123456789",
      invoices: [
        {
          id: "invoice-1",
          clientId: "client-1",
          issueDate: "2026-08-01",
          issuedAt: new Date("2026-08-01T10:00:00Z"),
          cancelledAt: null,
          total: "1210.00",
          outstanding: "1210.00",
          currency: "CZK",
          paymentAccountIban: "CZ0020100000000123456789",
          paymentVariableSymbol: "20260001",
        },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      invoiceId: "invoice-1",
      proposedAmount: "1210.00",
      confidence: "high",
    });
    expect(result[0] && isExactAutoMatchProposal(result[0])).toBe(true);
  });

  it("blocks an ambiguous variable symbol", () => {
    const invoice = {
      clientId: "client-1",
      issueDate: "2026-08-01",
      issuedAt: new Date("2026-08-01T10:00:00Z"),
      cancelledAt: null,
      total: "1210.00",
      outstanding: "1210.00",
      currency: "CZK",
      paymentAccountIban: "CZ0020100000000123456789",
      paymentVariableSymbol: "20260001",
    };
    const result = proposeInvoiceMatches({
      transaction,
      receivingIban: "CZ0020100000000123456789",
      invoices: [
        { ...invoice, id: "invoice-1" },
        { ...invoice, id: "invoice-2" },
      ],
    });
    expect(
      result.every((row) => row.blockers.includes("ambiguous_variable_symbol")),
    ).toBe(true);
  });

  it("proposes only the incoming amount for a partial payment", () => {
    const result = proposeInvoiceMatches({
      transaction: { ...transaction, amount: "500.00" },
      receivingIban: "CZ0020100000000123456789",
      invoices: [
        {
          id: "invoice-1",
          clientId: "client-1",
          issueDate: "2026-08-01",
          issuedAt: new Date("2026-08-01T10:00:00Z"),
          cancelledAt: null,
          total: "1210.00",
          outstanding: "1210.00",
          currency: "CZK",
          paymentAccountIban: "CZ0020100000000123456789",
          paymentVariableSymbol: "20260001",
        },
      ],
    });
    expect(result[0]).toMatchObject({
      proposedAmount: "500.00",
      confidence: "high",
      reasons: expect.arrayContaining(["partial_amount"]),
    });
    expect(result[0] && isExactAutoMatchProposal(result[0])).toBe(false);
  });

  it("rejects currency and receiving-account mismatches", () => {
    const invoice = {
      id: "invoice-1",
      clientId: "client-1",
      issueDate: "2026-08-01",
      issuedAt: new Date("2026-08-01T10:00:00Z"),
      cancelledAt: null,
      total: "1210.00",
      outstanding: "1210.00",
      currency: "EUR",
      paymentAccountIban: "CZ0020100000000123456789",
      paymentVariableSymbol: "20260001",
    };
    expect(
      proposeInvoiceMatches({
        transaction,
        receivingIban: "CZ0020100000000123456789",
        invoices: [invoice],
      }),
    ).toEqual([]);
    expect(
      proposeInvoiceMatches({
        transaction,
        receivingIban: "CZ0020100000000123456789",
        invoices: [
          {
            ...invoice,
            currency: "CZK",
            paymentAccountIban: "CZ9708000000001920014539",
          },
        ],
      }),
    ).toEqual([]);
  });
});

describe("derivePaymentState", () => {
  it.each([
    ["0.00", "unpaid", "1210.00"],
    ["500.00", "partial", "710.00"],
    ["1210.00", "paid", "0.00"],
    ["1300.00", "overpaid", "0.00"],
  ] as const)("derives %s allocated as %s", (allocated, state, outstanding) => {
    expect(derivePaymentState({ total: "1210.00", allocated })).toMatchObject({
      state,
      outstanding,
    });
  });
});
