import { beforeEach, describe, expect, it, vi } from "vitest";

const transactionMocks = vi.hoisted(() => ({
  withDbTransaction: vi.fn(),
}));

vi.mock("@invoicey/db/transaction", () => ({
  withDbTransaction: transactionMocks.withDbTransaction,
}));

import { bulkCancelInvoices, cancelInvoiceById } from "./invoice-ops";

type MutableInvoice = {
  id: string;
  workspaceId: string;
  issuedAt: Date | null;
  paidAmount: string;
  paidAt: Date | null;
  cancelledAt: Date | null;
  updatedAt: Date;
};

function invoice(overrides: Partial<MutableInvoice> = {}): MutableInvoice {
  return {
    id: "invoice-1",
    workspaceId: "workspace-1",
    issuedAt: new Date("2026-08-01T10:00:00.000Z"),
    paidAmount: "0.00",
    paidAt: null,
    cancelledAt: null,
    updatedAt: new Date("2026-08-01T10:00:00.000Z"),
    ...overrides,
  };
}

function lockingTransaction(row: MutableInvoice) {
  const lockModes: string[] = [];
  let updateCount = 0;
  let locked = false;
  const select = {
    from: () => select,
    where: () => select,
    for: (mode: string) => {
      locked = mode === "update";
      lockModes.push(mode);
      return select;
    },
    limit: async () => [row],
  };
  const tx = {
    select: () => select,
    update: () => ({
      set: () => ({
        where: async () => {
          if (!locked) {
            throw new Error("invoice mutation requires its row lock");
          }
          row.cancelledAt = new Date("2026-08-24T10:00:00.000Z");
          updateCount += 1;
        },
      }),
    }),
  };
  return {
    tx,
    lockModes,
    updateCount: () => updateCount,
  };
}

describe("invoice cancellation locking", () => {
  beforeEach(() => {
    transactionMocks.withDbTransaction.mockReset();
  });

  it("locks the invoice before cancelling so a later allocation observes the cancellation", async () => {
    const row = invoice();
    const transaction = lockingTransaction(row);
    transactionMocks.withDbTransaction.mockImplementation(async (callback) =>
      callback(transaction.tx as never),
    );

    const result = await cancelInvoiceById({
      id: row.id,
      workspaceId: row.workspaceId,
    });

    expect(result.ok).toBe(true);
    expect(transactionMocks.withDbTransaction).toHaveBeenCalledTimes(1);
    expect(transaction.lockModes).toEqual(["update"]);
    expect(transaction.updateCount()).toBe(1);
    expect(row.cancelledAt).not.toBeNull();
  });

  it("does not cancel when an allocation acquired the row lock first", async () => {
    const row = invoice({ paidAmount: "100.00" });
    const transaction = lockingTransaction(row);
    transactionMocks.withDbTransaction.mockImplementation(async (callback) =>
      callback(transaction.tx as never),
    );

    const result = await cancelInvoiceById({
      id: row.id,
      workspaceId: row.workspaceId,
    });

    expect(result).toEqual({ ok: false, error: "cannot_cancel" });
    expect(transaction.lockModes).toEqual(["update"]);
    expect(transaction.updateCount()).toBe(0);
    expect(row.cancelledAt).toBeNull();
  });

  it("uses the same row-locking cancellation path for every bulk item", async () => {
    const first = lockingTransaction(invoice({ id: "invoice-1" }));
    const second = lockingTransaction(
      invoice({ id: "invoice-2", paidAmount: "100.00" }),
    );
    const transactions = [first, second];
    transactionMocks.withDbTransaction.mockImplementation(async (callback) => {
      const transaction = transactions.shift();
      if (!transaction) throw new Error("unexpected transaction");
      return callback(transaction.tx as never);
    });

    await expect(
      bulkCancelInvoices({
        ids: ["invoice-1", "invoice-2"],
        workspaceId: "workspace-1",
      }),
    ).resolves.toEqual({ ok: 1, skipped: 1, failed: 0 });

    expect(transactionMocks.withDbTransaction).toHaveBeenCalledTimes(2);
    expect(first.lockModes).toEqual(["update"]);
    expect(second.lockModes).toEqual(["update"]);
  });
});
