import "server-only";
import {
  createPaymentRequestAllocation,
  listOpenPaymentRequestsForAccount,
  paymentMatchProposals,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
  decidePaymentRequestMatch,
  type PaymentRequestCandidate,
} from "@invoicey/payment-core";

import { normalizePaymentVariableSymbol } from "./invoice-payment-identifiers";

export type PaymentRequestMatchResult = {
  handled: boolean;
  proposed: number;
  autoMatched: number;
  pendingProposalIds: string[];
  settledRequestId?: string;
};

const REQUEST_MATCHER_VERSION = "payment-request-v1";

function asCandidate(
  row: Awaited<ReturnType<typeof listOpenPaymentRequestsForAccount>>[number],
): PaymentRequestCandidate {
  return {
    id: row.id,
    status:
      row.status === "settled" || row.status === "cancelled"
        ? row.status
        : "open",
    amount: row.amount,
    allocated: row.allocatedAmount,
    variableSymbol: row.variableSymbol,
  };
}

async function insertRequestProposals(input: {
  workspaceId: string;
  bankTransactionId: string;
  requestIds: string[];
  amount: string;
  reasons: string[];
  blockers: string[];
  score: number;
  confidence: "high" | "medium" | "low";
}): Promise<string[]> {
  const inserted = await db
    .insert(paymentMatchProposals)
    .values(
      input.requestIds.map((paymentRequestId) => ({
        workspaceId: input.workspaceId,
        bankTransactionId: input.bankTransactionId,
        paymentRequestId,
        proposedAmount: input.amount,
        score: input.score,
        confidence: input.confidence,
        reasonCodes: input.reasons,
        blockerCodes: input.blockers,
        matcherVersion: REQUEST_MATCHER_VERSION,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: paymentMatchProposals.id });
  return inserted.map((row) => row.id);
}

/**
 * Tries payment-request matching before the invoice matcher.
 *
 * Exact symbol + exact remaining amount self-settles (ADR 0051) and never
 * consults `autoConfirmExactMatches`. Everything else becomes a proposal or
 * falls through so invoice matching can still run.
 */
export async function matchCreditAgainstPaymentRequests(input: {
  workspaceId: string;
  bankAccountId: string;
  bankTransactionId: string;
  creditAmount: string;
  creditSymbol: string | null;
  currency: string;
  bookedDate: string;
}): Promise<PaymentRequestMatchResult> {
  const empty: PaymentRequestMatchResult = {
    handled: false,
    proposed: 0,
    autoMatched: 0,
    pendingProposalIds: [],
  };
  const requests = await listOpenPaymentRequestsForAccount(db, {
    workspaceId: input.workspaceId,
    bankAccountId: input.bankAccountId,
  });
  if (requests.length === 0) return empty;

  const decision = decidePaymentRequestMatch({
    creditAmount: input.creditAmount,
    creditSymbol: normalizePaymentVariableSymbol(input.creditSymbol),
    requests: requests.map(asCandidate),
  });
  if (decision.action === "unmatched") return empty;

  if (decision.action === "settle" || decision.action === "partial") {
    const created = await createPaymentRequestAllocation({
      workspaceId: input.workspaceId,
      paymentRequestId: decision.requestId,
      bankTransactionId: input.bankTransactionId,
      amount: decision.amount,
      currency: input.currency,
      effectiveDate: input.bookedDate,
      actorType: "system",
      overAmount:
        decision.action === "settle" ? decision.overAmount : undefined,
    });
    if (!created.ok) return empty;
    return {
      handled: true,
      proposed: 0,
      autoMatched: 1,
      pendingProposalIds: [],
      settledRequestId:
        created.becamePaid || decision.action === "settle"
          ? decision.requestId
          : undefined,
    };
  }

  if (decision.action === "duplicate") {
    const ids = await insertRequestProposals({
      workspaceId: input.workspaceId,
      bankTransactionId: input.bankTransactionId,
      requestIds: [decision.requestId],
      amount: input.creditAmount,
      reasons: ["exact_variable_symbol"],
      blockers: ["already_settled"],
      score: 100,
      confidence: "high",
    });
    return {
      handled: true,
      proposed: ids.length,
      autoMatched: 0,
      pendingProposalIds: ids,
    };
  }

  const ids = await insertRequestProposals({
    workspaceId: input.workspaceId,
    bankTransactionId: input.bankTransactionId,
    requestIds: decision.requestIds,
    amount: decision.amount,
    reasons: ["exact_outstanding_amount"],
    blockers:
      decision.requestIds.length > 1 ? ["ambiguous_payment_request"] : [],
    score: decision.requestIds.length > 1 ? 60 : 80,
    confidence: decision.requestIds.length > 1 ? "medium" : "high",
  });
  return {
    handled: true,
    proposed: ids.length,
    autoMatched: 0,
    pendingProposalIds: ids,
  };
}
