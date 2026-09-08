import "server-only";
import { randomBytes } from "node:crypto";

import {
  isPaymentSymbolTaken,
  paymentRequests,
  type PaymentRequestRow,
} from "@invoicey/db";
import { withDbTransaction } from "@invoicey/db/transaction";
import { allocatePaymentRequestSymbol } from "@invoicey/payment-core";

function publicToken(): string {
  return randomBytes(18).toString("base64url");
}

export async function createStandalonePaymentRequest(input: {
  workspaceId: string;
  issuerId: string;
  bankAccountId: string;
  iban: string;
  amount: string;
  message?: string | null;
  createdByUserId: string;
}): Promise<PaymentRequestRow> {
  return withDbTransaction(async (tx) => {
    const variableSymbol = await allocatePaymentRequestSymbol({
      isTaken: (symbol) =>
        isPaymentSymbolTaken(tx, {
          bankAccountId: input.bankAccountId,
          iban: input.iban,
          symbol,
        }),
    });
    const [row] = await tx
      .insert(paymentRequests)
      .values({
        workspaceId: input.workspaceId,
        issuerId: input.issuerId,
        bankAccountId: input.bankAccountId,
        amount: input.amount,
        currency: "CZK",
        variableSymbol,
        message: input.message?.trim() || null,
        status: "open",
        publicToken: publicToken(),
        createdByUserId: input.createdByUserId,
      })
      .returning();
    if (!row) throw new Error("payment_request_insert_failed");
    return row;
  });
}
