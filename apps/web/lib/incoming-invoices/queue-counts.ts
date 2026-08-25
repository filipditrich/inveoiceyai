import { incomingInvoices, supplierBankAccounts } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { eq } from "drizzle-orm";

import { isIncomingInvoicePaymentRunEligible } from "./eligibility";

export type IncomingQueueCounts = {
  review: number;
  approval: number;
  pay: number;
  all: number;
};

export function incomingQueueCountsFromRows(
  rows: Array<Parameters<typeof isIncomingInvoicePaymentRunEligible>[0]>,
): IncomingQueueCounts {
  return {
    review: rows.filter((row) =>
      ["needs_validation", "unsupported", "on_hold"].includes(row.status),
    ).length,
    approval: rows.filter((row) => row.status === "pending_approval").length,
    pay: rows.filter(isIncomingInvoicePaymentRunEligible).length,
    all: rows.length,
  };
}

export async function loadIncomingQueueCounts(
  workspaceId: string,
): Promise<IncomingQueueCounts> {
  const rows = await db
    .select({
      status: incomingInvoices.status,
      holdUntil: incomingInvoices.holdUntil,
      paymentState: incomingInvoices.paymentState,
      total: incomingInvoices.total,
      paidAmount: incomingInvoices.paidAmount,
      currency: incomingInvoices.currency,
      paymentMethod: incomingInvoices.paymentMethod,
      beneficiaryConfirmed: supplierBankAccounts.confirmedAt,
      hasBeneficiary: incomingInvoices.beneficiaryIban,
      iban: incomingInvoices.beneficiaryIban,
      accountNumber: incomingInvoices.beneficiaryAccountNumber,
      bankCode: incomingInvoices.beneficiaryBankCode,
      activePaymentRunId: incomingInvoices.activePaymentRunId,
      docType: incomingInvoices.docType,
    })
    .from(incomingInvoices)
    .leftJoin(
      supplierBankAccounts,
      eq(incomingInvoices.supplierBankAccountId, supplierBankAccounts.id),
    )
    .where(eq(incomingInvoices.workspaceId, workspaceId));
  return incomingQueueCountsFromRows(
    rows.map((row) => ({
      ...row,
      outstanding: String(
        Math.max(0, Number(row.total ?? 0) - Number(row.paidAmount ?? 0)),
      ),
      runCurrency: "CZK",
      beneficiaryConfirmed: Boolean(row.beneficiaryConfirmed),
      hasBeneficiary: Boolean(
        row.hasBeneficiary || (row.accountNumber && row.bankCode),
      ),
    })),
  );
}
