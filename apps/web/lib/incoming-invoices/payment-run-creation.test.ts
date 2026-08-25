import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

const transactionMocks = vi.hoisted(() => ({
  withDbTransaction: vi.fn(),
}));

vi.mock("@invoicey/db/transaction", () => transactionMocks);

import {
  EmptyPaymentRunError,
  createPaymentRunTransaction,
} from "./payment-run-transaction";
import {
  bankAccountIssuers,
  bankAccounts,
  incomingInvoices,
  issuerBusinesses,
  paymentRunLines,
  paymentRuns,
  supplierBankAccounts,
} from "@invoicey/db";
import { paymentRunRelationshipsAreValid } from "./payment-run-creation";

type TransactionScenario = { claimSucceeds: boolean };

function validInvoice() {
  return {
    id: "invoice-1",
    workspaceId: "workspace-1",
    issuerId: "issuer-1",
    supplierId: null,
    supplierBankAccountId: "supplier-account-1",
    total: "100",
    paidAmount: "0",
    status: "approved",
    holdUntil: null,
    paymentState: "unpaid",
    currency: "CZK",
    paymentMethod: "transfer",
    beneficiaryIban: "CZ6508000000192000145399",
    beneficiaryAccountNumber: null,
    beneficiaryBankCode: null,
    beneficiaryBic: null,
    variableSymbol: null,
    constantSymbol: null,
    specificSymbol: null,
    messageForRecipient: null,
    docType: "invoice",
    activePaymentRunId: null,
  };
}

function resolvedQuery<T>(value: T) {
  const promise = Promise.resolve(value);
  return {
    returning: () => promise,
    then: promise.then.bind(promise),
  };
}

function transactionFor({ claimSucceeds }: TransactionScenario) {
  const locks: string[] = [];
  const claimConditions: unknown[] = [];
  const paymentLines: unknown[] = [];
  const invoice = validInvoice();
  const tx = {
    select: vi.fn(() => {
      let table: unknown;
      const query = {
        from: (nextTable: unknown) => {
          table = nextTable;
          return query;
        },
        where: vi.fn(() => query),
        orderBy: () => query,
        limit: () => {
          if (table === issuerBusinesses) {
            return Promise.resolve([
              { id: "issuer-1", workspaceId: "workspace-1" },
            ]);
          }
          if (table === bankAccounts) {
            return Promise.resolve([
              {
                id: "bank-account-1",
                workspaceId: "workspace-1",
                currency: "CZK",
              },
            ]);
          }
          if (table === bankAccountIssuers) {
            return Promise.resolve([
              {
                workspaceId: "workspace-1",
                bankAccountId: "bank-account-1",
                issuerId: "issuer-1",
              },
            ]);
          }
          if (table === incomingInvoices) return Promise.resolve([invoice]);
          if (table === supplierBankAccounts) {
            return Promise.resolve([{ confirmedAt: new Date() }]);
          }
          if (table === paymentRunLines) {
            return Promise.resolve([{ total: "100", count: 1 }]);
          }
          return Promise.resolve([]);
        },
        for: (mode: string) => {
          locks.push(mode);
          return Promise.resolve([invoice]);
        },
        then: (
          onfulfilled: (value: unknown) => unknown,
          onrejected?: (reason: unknown) => unknown,
        ) =>
          Promise.resolve(
            table === paymentRunLines ? [{ total: "100", count: 1 }] : [],
          ).then(onfulfilled, onrejected),
      };
      return query;
    }),
    insert: vi.fn((table: unknown) => ({
      values: (values: unknown) => {
        if (table === paymentRuns) {
          return { returning: async () => [{ id: "run-1" }] };
        }
        if (table === paymentRunLines) {
          paymentLines.push(values);
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      },
    })),
    update: vi.fn((table: unknown) => ({
      set: () => ({
        where: (condition: unknown) => {
          if (table === incomingInvoices) {
            claimConditions.push(condition);
            return resolvedQuery(claimSucceeds ? [{ id: "invoice-1" }] : []);
          }
          return resolvedQuery([]);
        },
      }),
    })),
  };
  return { claimConditions, locks, paymentLines, tx };
}

const input = {
  workspaceId: "workspace-1",
  userId: "user-1",
  issuerId: "issuer-1",
  bankAccountId: "bank-account-1",
  currency: "CZK",
  executionDate: "2026-08-24",
  name: "Payments 2026-W34",
  ids: ["invoice-1"],
};

describe("payment run creation transaction", () => {
  it("locks rows, conditionally claims them, and inserts a line in one transaction", async () => {
    const { claimConditions, locks, paymentLines, tx } = transactionFor({
      claimSucceeds: true,
    });
    transactionMocks.withDbTransaction.mockImplementation(async (callback) =>
      callback(tx),
    );

    await expect(createPaymentRunTransaction(input)).resolves.toEqual({
      id: "run-1",
    });
    expect(locks).toEqual(["update"]);
    expect(paymentLines).toHaveLength(1);
    const query = new PgDialect().sqlToQuery(claimConditions[0] as never);
    expect(query.sql).toContain('"active_payment_run_id" is null');
    expect(query.sql).toContain('"workspace_id" = $');
    expect(query.sql).toContain('"issuer_id" = $');
  });

  it("throws inside the transaction when no conditional claim succeeds, so no empty run commits", async () => {
    const { paymentLines, tx } = transactionFor({ claimSucceeds: false });
    const rolledBack = vi.fn();
    transactionMocks.withDbTransaction.mockImplementation(async (callback) => {
      try {
        return await callback(tx);
      } catch (error) {
        rolledBack(error);
        throw error;
      }
    });

    await expect(createPaymentRunTransaction(input)).rejects.toBeInstanceOf(
      EmptyPaymentRunError,
    );
    expect(rolledBack).toHaveBeenCalledOnce();
    expect(paymentLines).toEqual([]);
  });
});

describe("payment run relationship validation", () => {
  it("requires workspace, issuer, bank mapping, and currency relationships", () => {
    const base = {
      workspaceId: "workspace-a",
      issuerId: "issuer-a",
      bankAccountId: "account-a",
      currency: "CZK",
      issuer: { id: "issuer-a", workspaceId: "workspace-a" },
      bankAccount: {
        id: "account-a",
        workspaceId: "workspace-a",
        currency: "CZK",
      },
      accountIssuer: {
        workspaceId: "workspace-a",
        bankAccountId: "account-a",
        issuerId: "issuer-a",
      },
      invoices: [{ workspaceId: "workspace-a", issuerId: "issuer-a" }],
      selectedInvoiceCount: 1,
    };
    expect(paymentRunRelationshipsAreValid(base)).toBe(true);
    expect(
      paymentRunRelationshipsAreValid({
        ...base,
        bankAccount: { ...base.bankAccount, workspaceId: "workspace-b" },
      }),
    ).toBe(false);
    expect(
      paymentRunRelationshipsAreValid({
        ...base,
        invoices: [{ workspaceId: "workspace-a", issuerId: "issuer-b" }],
      }),
    ).toBe(false);
    expect(
      paymentRunRelationshipsAreValid({
        ...base,
        accountIssuer: { ...base.accountIssuer, issuerId: "issuer-b" },
      }),
    ).toBe(false);
    expect(
      paymentRunRelationshipsAreValid({
        ...base,
        bankAccount: { ...base.bankAccount, currency: "EUR" },
      }),
    ).toBe(false);
  });
});
