import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { enqueueNotificationEvent } from "./notifications-repo";
import {
  bankTransactions,
  invoices,
  paymentAllocations,
  paymentAuditEvents,
  paymentMatchProposals,
  paymentRequests,
} from "./schema";
import { withDbTransaction, type DbTransaction } from "./transaction";

export type PaymentState = "unpaid" | "partial" | "paid" | "overpaid";

export type AllocationMutationResult =
  | {
      ok: true;
      invoiceId?: string;
      paymentRequestId?: string;
      allocationId: string;
      paidAmount: string;
      paymentState: PaymentState;
      becamePaid: boolean;
    }
  | { ok: false; error: string };

function stateSql() {
  return sql<PaymentState>`CASE
    WHEN coalesce(sum(${paymentAllocations.amount}) FILTER (WHERE ${paymentAllocations.reversedAt} IS NULL), 0) <= 0 THEN 'unpaid'
    WHEN coalesce(sum(${paymentAllocations.amount}) FILTER (WHERE ${paymentAllocations.reversedAt} IS NULL), 0) < abs(${invoices.total}) THEN 'partial'
    WHEN coalesce(sum(${paymentAllocations.amount}) FILTER (WHERE ${paymentAllocations.reversedAt} IS NULL), 0) = abs(${invoices.total}) THEN 'paid'
    ELSE 'overpaid'
  END`;
}

async function refreshInvoicePaymentProjection(
  tx: DbTransaction,
  workspaceId: string,
  invoiceId: string,
): Promise<{
  paidAmount: string;
  paymentState: PaymentState;
  becamePaid: boolean;
}> {
  const [before] = await tx
    .select({ paymentState: invoices.paymentState })
    .from(invoices)
    .where(
      and(eq(invoices.id, invoiceId), eq(invoices.workspaceId, workspaceId)),
    )
    .for("update")
    .limit(1);
  if (!before) throw new Error("invoice_not_found");

  const [projection] = await tx
    .select({
      paidAmount: sql<string>`coalesce(sum(${paymentAllocations.amount}) FILTER (WHERE ${paymentAllocations.reversedAt} IS NULL), 0)::text`,
      paymentState: stateSql(),
    })
    .from(invoices)
    .leftJoin(
      paymentAllocations,
      and(
        eq(paymentAllocations.invoiceId, invoices.id),
        eq(paymentAllocations.workspaceId, workspaceId),
      ),
    )
    .where(
      and(eq(invoices.id, invoiceId), eq(invoices.workspaceId, workspaceId)),
    )
    .groupBy(invoices.id);
  if (!projection) throw new Error("invoice_not_found");

  const isSettled =
    projection.paymentState === "paid" ||
    projection.paymentState === "overpaid";
  await tx
    .update(invoices)
    .set({
      paidAmount: projection.paidAmount,
      paymentState: projection.paymentState,
      paidAt: isSettled ? sql`coalesce(${invoices.paidAt}, now())` : null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(invoices.id, invoiceId), eq(invoices.workspaceId, workspaceId)),
    );

  return {
    ...projection,
    becamePaid:
      isSettled &&
      before.paymentState !== "paid" &&
      before.paymentState !== "overpaid",
  };
}

function requestPaymentState(
  requested: string,
  allocated: string,
): PaymentState {
  const asked = Number(requested);
  const paid = Number(allocated);
  if (paid <= 0) return "unpaid";
  if (paid < asked) return "partial";
  if (paid === asked) return "paid";
  return "overpaid";
}

async function refreshPaymentRequestProjection(
  tx: DbTransaction,
  workspaceId: string,
  paymentRequestId: string,
): Promise<{
  paidAmount: string;
  paymentState: PaymentState;
  becamePaid: boolean;
}> {
  const [before] = await tx
    .select({
      status: paymentRequests.status,
      amount: paymentRequests.amount,
    })
    .from(paymentRequests)
    .where(
      and(
        eq(paymentRequests.id, paymentRequestId),
        eq(paymentRequests.workspaceId, workspaceId),
      ),
    )
    .for("update")
    .limit(1);
  if (!before) throw new Error("payment_request_not_found");

  const [usage] = await tx
    .select({
      paidAmount: sql<string>`coalesce(sum(${paymentAllocations.amount}) FILTER (WHERE ${paymentAllocations.reversedAt} IS NULL), 0)::text`,
    })
    .from(paymentAllocations)
    .where(
      and(
        eq(paymentAllocations.paymentRequestId, paymentRequestId),
        eq(paymentAllocations.workspaceId, workspaceId),
      ),
    );
  const paidAmount = usage?.paidAmount ?? "0";
  const paymentState = requestPaymentState(before.amount, paidAmount);
  const isSettled = paymentState === "paid" || paymentState === "overpaid";

  if (before.status !== "cancelled") {
    await tx
      .update(paymentRequests)
      .set({
        status: isSettled ? "settled" : "open",
        settledAt: isSettled
          ? sql`coalesce(${paymentRequests.settledAt}, now())`
          : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentRequests.id, paymentRequestId),
          eq(paymentRequests.workspaceId, workspaceId),
        ),
      );
  }

  return {
    paidAmount,
    paymentState,
    becamePaid: isSettled && before.status !== "settled",
  };
}

async function remainingOnTransaction(
  tx: DbTransaction,
  bankTransactionId: string,
): Promise<number> {
  const [usage] = await tx
    .select({
      allocated: sql<string>`coalesce(sum(${paymentAllocations.amount}), 0)::text`,
    })
    .from(paymentAllocations)
    .where(
      and(
        eq(paymentAllocations.bankTransactionId, bankTransactionId),
        isNull(paymentAllocations.reversedAt),
      ),
    );
  return Number(usage?.allocated ?? 0);
}

async function addAuditEvent(
  tx: DbTransaction,
  input: {
    workspaceId: string;
    action: string;
    actorType: "user" | "system";
    actorUserId?: string;
    entityType: string;
    entityId: string;
    payload?: Record<string, unknown>;
  },
) {
  await tx.insert(paymentAuditEvents).values({
    workspaceId: input.workspaceId,
    action: input.action,
    actorType: input.actorType,
    actorUserId: input.actorUserId,
    entityType: input.entityType,
    entityId: input.entityId,
    payloadJson: input.payload ?? {},
  });
}

async function enqueueSettledPaymentRequest(
  tx: DbTransaction,
  input: {
    workspaceId: string;
    requestId: string;
    allocationId: string;
    amount: string;
    currency: string;
    message: string | null;
    variableSymbol: string;
    becamePaid: boolean;
  },
): Promise<void> {
  if (!input.becamePaid) return;
  await enqueueNotificationEvent(tx, {
    workspaceId: input.workspaceId,
    type: "payment_request.settled",
    subjectType: "payment_request",
    subjectId: input.requestId,
    dedupeKey: `payment_request.settled:${input.allocationId}`,
    payload: {
      amount: input.amount,
      currency: input.currency,
      message: input.message,
      variableSymbol: input.variableSymbol,
      allocationId: input.allocationId,
    },
  });
}

export async function createManualPaymentAllocation(input: {
  workspaceId: string;
  invoiceId: string;
  amount: string;
  effectiveDate: string;
  actorUserId?: string;
  actorType?: "user" | "system";
}): Promise<AllocationMutationResult> {
  try {
    return await withDbTransaction(async (tx) => {
      const [invoice] = await tx
        .select({
          id: invoices.id,
          currency: invoices.currency,
          issuedAt: invoices.issuedAt,
          cancelledAt: invoices.cancelledAt,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.invoiceId),
            eq(invoices.workspaceId, input.workspaceId),
          ),
        )
        .for("update")
        .limit(1);
      if (!invoice) return { ok: false, error: "invoice_not_found" };
      if (!invoice.issuedAt || invoice.cancelledAt) {
        return { ok: false, error: "cannot_mark_paid" };
      }

      const [allocation] = await tx
        .insert(paymentAllocations)
        .values({
          workspaceId: input.workspaceId,
          invoiceId: input.invoiceId,
          source: "manual",
          amount: input.amount,
          currency: invoice.currency,
          effectiveDate: input.effectiveDate,
          confirmedByUserId: input.actorUserId,
        })
        .returning({ id: paymentAllocations.id });
      if (!allocation) throw new Error("allocation_insert_failed");

      const projection = await refreshInvoicePaymentProjection(
        tx,
        input.workspaceId,
        input.invoiceId,
      );
      await addAuditEvent(tx, {
        workspaceId: input.workspaceId,
        action: "allocation.created",
        actorType: input.actorType ?? (input.actorUserId ? "user" : "system"),
        actorUserId: input.actorUserId,
        entityType: "invoice_payment_allocation",
        entityId: allocation.id,
        payload: { invoiceId: input.invoiceId, amount: input.amount },
      });
      return {
        ok: true,
        invoiceId: input.invoiceId,
        allocationId: allocation.id,
        ...projection,
      };
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "allocation_failed",
    };
  }
}

export async function confirmPaymentMatchProposal(input: {
  workspaceId: string;
  proposalId: string;
  actorUserId?: string;
  actorType?: "user" | "system";
}): Promise<AllocationMutationResult> {
  try {
    return await withDbTransaction(async (tx) => {
      const [proposal] = await tx
        .select({
          id: paymentMatchProposals.id,
          invoiceId: paymentMatchProposals.invoiceId,
          paymentRequestId: paymentMatchProposals.paymentRequestId,
          bankTransactionId: paymentMatchProposals.bankTransactionId,
          amount: paymentMatchProposals.proposedAmount,
          transactionAmount: bankTransactions.amount,
          status: paymentMatchProposals.status,
          bookedDate: bankTransactions.bookedDate,
          currency: bankTransactions.currency,
          direction: bankTransactions.direction,
        })
        .from(paymentMatchProposals)
        .innerJoin(
          bankTransactions,
          eq(bankTransactions.id, paymentMatchProposals.bankTransactionId),
        )
        .where(
          and(
            eq(paymentMatchProposals.id, input.proposalId),
            eq(paymentMatchProposals.workspaceId, input.workspaceId),
          ),
        )
        .for("update")
        .limit(1);
      if (!proposal) return { ok: false, error: "proposal_not_found" };
      if (proposal.status !== "pending") {
        return { ok: false, error: "proposal_already_reviewed" };
      }
      if (proposal.direction !== "credit") {
        return {
          ok: false,
          error: "only_credit_transactions_can_be_allocated",
        };
      }
      if (proposal.paymentRequestId) {
        return confirmRequestProposal(tx, input, {
          ...proposal,
          paymentRequestId: proposal.paymentRequestId,
        });
      }
      if (!proposal.invoiceId) {
        return { ok: false, error: "proposal_target_missing" };
      }
      return confirmInvoiceProposal(tx, input, {
        ...proposal,
        invoiceId: proposal.invoiceId,
      });
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "confirmation_failed",
    };
  }
}

async function confirmInvoiceProposal(
  tx: DbTransaction,
  input: {
    workspaceId: string;
    actorUserId?: string;
    actorType?: "user" | "system";
  },
  proposal: {
    id: string;
    invoiceId: string;
    bankTransactionId: string;
    amount: string;
    transactionAmount: string;
    bookedDate: string;
    currency: string;
  },
): Promise<AllocationMutationResult> {
  const [invoice] = await tx
    .select({
      currency: invoices.currency,
      cancelledAt: invoices.cancelledAt,
      total: invoices.total,
      paidAmount: invoices.paidAmount,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.id, proposal.invoiceId),
        eq(invoices.workspaceId, input.workspaceId),
      ),
    )
    .for("update")
    .limit(1);
  if (!invoice || invoice.cancelledAt) {
    return { ok: false, error: "invoice_not_available" };
  }
  if (invoice.currency !== proposal.currency) {
    return { ok: false, error: "currency_mismatch" };
  }
  const invoiceOutstanding = Math.max(
    0,
    Math.abs(Number(invoice.total)) - Number(invoice.paidAmount),
  );
  if (Number(proposal.amount) > invoiceOutstanding) {
    return { ok: false, error: "proposal_is_stale" };
  }
  const allocated = await remainingOnTransaction(
    tx,
    proposal.bankTransactionId,
  );
  if (
    allocated + Number(proposal.amount) >
    Number(proposal.transactionAmount)
  ) {
    return { ok: false, error: "transaction_amount_exhausted" };
  }

  const [allocation] = await tx
    .insert(paymentAllocations)
    .values({
      workspaceId: input.workspaceId,
      invoiceId: proposal.invoiceId,
      bankTransactionId: proposal.bankTransactionId,
      proposalId: proposal.id,
      source: "bank_confirmed",
      amount: proposal.amount,
      currency: proposal.currency,
      effectiveDate: proposal.bookedDate,
      confirmedByUserId: input.actorUserId,
    })
    .returning({ id: paymentAllocations.id });
  if (!allocation) throw new Error("allocation_insert_failed");

  await tx
    .update(paymentMatchProposals)
    .set({
      status: "confirmed",
      reviewedByUserId: input.actorUserId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(paymentMatchProposals.id, proposal.id));
  const projection = await refreshInvoicePaymentProjection(
    tx,
    input.workspaceId,
    proposal.invoiceId,
  );
  await addAuditEvent(tx, {
    workspaceId: input.workspaceId,
    action: "proposal.confirmed",
    actorType: input.actorType ?? (input.actorUserId ? "user" : "system"),
    actorUserId: input.actorUserId,
    entityType: "payment_match_proposal",
    entityId: proposal.id,
    payload: { allocationId: allocation.id, invoiceId: proposal.invoiceId },
  });
  return {
    ok: true,
    invoiceId: proposal.invoiceId,
    allocationId: allocation.id,
    ...projection,
  };
}

async function confirmRequestProposal(
  tx: DbTransaction,
  input: {
    workspaceId: string;
    actorUserId?: string;
    actorType?: "user" | "system";
  },
  proposal: {
    id: string;
    paymentRequestId: string;
    bankTransactionId: string;
    amount: string;
    transactionAmount: string;
    bookedDate: string;
    currency: string;
  },
): Promise<AllocationMutationResult> {
  const [request] = await tx
    .select({
      status: paymentRequests.status,
      amount: paymentRequests.amount,
      currency: paymentRequests.currency,
      message: paymentRequests.message,
      variableSymbol: paymentRequests.variableSymbol,
    })
    .from(paymentRequests)
    .where(
      and(
        eq(paymentRequests.id, proposal.paymentRequestId),
        eq(paymentRequests.workspaceId, input.workspaceId),
      ),
    )
    .for("update")
    .limit(1);
  if (!request || request.status === "cancelled") {
    return { ok: false, error: "payment_request_not_available" };
  }
  if (request.currency !== proposal.currency) {
    return { ok: false, error: "currency_mismatch" };
  }
  const current = await refreshPaymentRequestProjection(
    tx,
    input.workspaceId,
    proposal.paymentRequestId,
  );
  if (
    Number(proposal.amount) >
    Math.max(0, Number(request.amount) - Number(current.paidAmount))
  ) {
    return { ok: false, error: "proposal_is_stale" };
  }
  const allocated = await remainingOnTransaction(
    tx,
    proposal.bankTransactionId,
  );
  if (
    allocated + Number(proposal.amount) >
    Number(proposal.transactionAmount)
  ) {
    return { ok: false, error: "transaction_amount_exhausted" };
  }

  const [allocation] = await tx
    .insert(paymentAllocations)
    .values({
      workspaceId: input.workspaceId,
      paymentRequestId: proposal.paymentRequestId,
      bankTransactionId: proposal.bankTransactionId,
      proposalId: proposal.id,
      source: "bank_confirmed",
      amount: proposal.amount,
      currency: proposal.currency,
      effectiveDate: proposal.bookedDate,
      confirmedByUserId: input.actorUserId,
    })
    .returning({ id: paymentAllocations.id });
  if (!allocation) throw new Error("allocation_insert_failed");

  await tx
    .update(paymentMatchProposals)
    .set({
      status: "confirmed",
      reviewedByUserId: input.actorUserId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(paymentMatchProposals.id, proposal.id));
  const projection = await refreshPaymentRequestProjection(
    tx,
    input.workspaceId,
    proposal.paymentRequestId,
  );
  await addAuditEvent(tx, {
    workspaceId: input.workspaceId,
    action: "proposal.confirmed",
    actorType: input.actorType ?? (input.actorUserId ? "user" : "system"),
    actorUserId: input.actorUserId,
    entityType: "payment_match_proposal",
    entityId: proposal.id,
    payload: {
      allocationId: allocation.id,
      paymentRequestId: proposal.paymentRequestId,
    },
  });
  await enqueueSettledPaymentRequest(tx, {
    workspaceId: input.workspaceId,
    requestId: proposal.paymentRequestId,
    allocationId: allocation.id,
    amount: request.amount,
    currency: request.currency,
    message: request.message,
    variableSymbol: request.variableSymbol,
    becamePaid: projection.becamePaid,
  });
  return {
    ok: true,
    paymentRequestId: proposal.paymentRequestId,
    allocationId: allocation.id,
    ...projection,
  };
}

export async function createPaymentRequestAllocation(input: {
  workspaceId: string;
  paymentRequestId: string;
  bankTransactionId: string;
  amount: string;
  currency: string;
  effectiveDate: string;
  actorType?: "user" | "system";
  actorUserId?: string;
  overAmount?: string;
}): Promise<AllocationMutationResult> {
  try {
    return await withDbTransaction(async (tx) => {
      const [request] = await tx
        .select({
          id: paymentRequests.id,
          status: paymentRequests.status,
          amount: paymentRequests.amount,
          currency: paymentRequests.currency,
          message: paymentRequests.message,
          variableSymbol: paymentRequests.variableSymbol,
        })
        .from(paymentRequests)
        .where(
          and(
            eq(paymentRequests.id, input.paymentRequestId),
            eq(paymentRequests.workspaceId, input.workspaceId),
          ),
        )
        .for("update")
        .limit(1);
      if (!request || request.status !== "open") {
        return { ok: false, error: "payment_request_not_available" };
      }
      if (request.currency !== input.currency) {
        return { ok: false, error: "currency_mismatch" };
      }

      const [allocation] = await tx
        .insert(paymentAllocations)
        .values({
          workspaceId: input.workspaceId,
          paymentRequestId: input.paymentRequestId,
          bankTransactionId: input.bankTransactionId,
          source: "bank_confirmed",
          amount: input.amount,
          currency: input.currency,
          effectiveDate: input.effectiveDate,
          confirmedByUserId: input.actorUserId,
        })
        .returning({ id: paymentAllocations.id });
      if (!allocation) throw new Error("allocation_insert_failed");

      const projection = await refreshPaymentRequestProjection(
        tx,
        input.workspaceId,
        input.paymentRequestId,
      );
      await addAuditEvent(tx, {
        workspaceId: input.workspaceId,
        action: "allocation.created",
        actorType: input.actorType ?? "system",
        actorUserId: input.actorUserId,
        entityType: "payment_allocation",
        entityId: allocation.id,
        payload: {
          paymentRequestId: input.paymentRequestId,
          amount: input.amount,
          overAmount: input.overAmount ?? null,
        },
      });
      await enqueueSettledPaymentRequest(tx, {
        workspaceId: input.workspaceId,
        requestId: input.paymentRequestId,
        allocationId: allocation.id,
        amount: request.amount,
        currency: request.currency,
        message: request.message,
        variableSymbol: request.variableSymbol,
        becamePaid: projection.becamePaid,
      });
      return {
        ok: true,
        paymentRequestId: input.paymentRequestId,
        allocationId: allocation.id,
        ...projection,
      };
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "allocation_failed",
    };
  }
}

export async function rejectPaymentMatchProposal(input: {
  workspaceId: string;
  proposalId: string;
  actorUserId: string;
}): Promise<boolean> {
  return withDbTransaction(async (tx) => {
    const [updated] = await tx
      .update(paymentMatchProposals)
      .set({
        status: "rejected",
        reviewedByUserId: input.actorUserId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentMatchProposals.id, input.proposalId),
          eq(paymentMatchProposals.workspaceId, input.workspaceId),
          eq(paymentMatchProposals.status, "pending"),
        ),
      )
      .returning({ id: paymentMatchProposals.id });
    if (!updated) return false;
    await addAuditEvent(tx, {
      workspaceId: input.workspaceId,
      action: "proposal.rejected",
      actorType: "user",
      actorUserId: input.actorUserId,
      entityType: "payment_match_proposal",
      entityId: updated.id,
    });
    return true;
  });
}

export async function reversePaymentAllocation(input: {
  workspaceId: string;
  allocationId: string;
  actorUserId?: string;
  reason?: string;
}): Promise<AllocationMutationResult> {
  try {
    return await withDbTransaction(async (tx) => {
      const [allocation] = await tx
        .select({
          id: paymentAllocations.id,
          invoiceId: paymentAllocations.invoiceId,
          paymentRequestId: paymentAllocations.paymentRequestId,
          proposalId: paymentAllocations.proposalId,
        })
        .from(paymentAllocations)
        .where(
          and(
            eq(paymentAllocations.id, input.allocationId),
            eq(paymentAllocations.workspaceId, input.workspaceId),
            isNull(paymentAllocations.reversedAt),
          ),
        )
        .for("update")
        .limit(1);
      if (!allocation) return { ok: false, error: "allocation_not_found" };
      await tx
        .update(paymentAllocations)
        .set({
          reversedAt: new Date(),
          reversedByUserId: input.actorUserId,
          reversalReason: input.reason?.trim() || null,
        })
        .where(eq(paymentAllocations.id, allocation.id));
      if (allocation.proposalId) {
        await tx
          .update(paymentMatchProposals)
          .set({
            status: "pending",
            reviewedByUserId: null,
            reviewedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(paymentMatchProposals.id, allocation.proposalId));
      }
      const projection = allocation.paymentRequestId
        ? await refreshPaymentRequestProjection(
            tx,
            input.workspaceId,
            allocation.paymentRequestId,
          )
        : allocation.invoiceId
          ? await refreshInvoicePaymentProjection(
              tx,
              input.workspaceId,
              allocation.invoiceId,
            )
          : {
              paidAmount: "0",
              paymentState: "unpaid" as const,
              becamePaid: false,
            };
      await addAuditEvent(tx, {
        workspaceId: input.workspaceId,
        action: "allocation.reversed",
        actorType: input.actorUserId ? "user" : "system",
        actorUserId: input.actorUserId,
        entityType: "payment_allocation",
        entityId: allocation.id,
        payload: { reason: input.reason ?? null },
      });
      return {
        ok: true,
        invoiceId: allocation.invoiceId ?? undefined,
        paymentRequestId: allocation.paymentRequestId ?? undefined,
        allocationId: allocation.id,
        ...projection,
      };
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "reversal_failed",
    };
  }
}

/** Compatibility operation for the legacy “mark unpaid” controls. */
export async function reverseAllInvoicePaymentAllocations(input: {
  workspaceId: string;
  invoiceId: string;
  actorUserId?: string;
  reason?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    return await withDbTransaction(async (tx) => {
      const active = await tx
        .select({
          id: paymentAllocations.id,
          proposalId: paymentAllocations.proposalId,
        })
        .from(paymentAllocations)
        .where(
          and(
            eq(paymentAllocations.workspaceId, input.workspaceId),
            eq(paymentAllocations.invoiceId, input.invoiceId),
            isNull(paymentAllocations.reversedAt),
          ),
        )
        .for("update");
      if (active.length === 0)
        return { ok: false, error: "no_active_allocations" };
      const now = new Date();
      await tx
        .update(paymentAllocations)
        .set({
          reversedAt: now,
          reversedByUserId: input.actorUserId,
          reversalReason: input.reason ?? "Marked unpaid",
        })
        .where(
          and(
            eq(paymentAllocations.workspaceId, input.workspaceId),
            eq(paymentAllocations.invoiceId, input.invoiceId),
            isNull(paymentAllocations.reversedAt),
          ),
        );
      const proposalIds = active
        .map((row) => row.proposalId)
        .filter((id): id is string => id !== null);
      if (proposalIds.length > 0) {
        await tx
          .update(paymentMatchProposals)
          .set({
            status: "pending",
            reviewedByUserId: null,
            reviewedAt: null,
            updatedAt: now,
          })
          .where(inArray(paymentMatchProposals.id, proposalIds));
      }
      await refreshInvoicePaymentProjection(
        tx,
        input.workspaceId,
        input.invoiceId,
      );
      await addAuditEvent(tx, {
        workspaceId: input.workspaceId,
        action: "invoice.allocations_reversed",
        actorType: input.actorUserId ? "user" : "system",
        actorUserId: input.actorUserId,
        entityType: "invoice",
        entityId: input.invoiceId,
        payload: { allocationIds: active.map((row) => row.id) },
      });
      return { ok: true };
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "reversal_failed",
    };
  }
}

export async function listInvoicePaymentAllocations(
  database: Pick<DbTransaction, "select">,
  workspaceId: string,
  invoiceId: string,
) {
  return database
    .select()
    .from(paymentAllocations)
    .where(
      and(
        eq(paymentAllocations.workspaceId, workspaceId),
        eq(paymentAllocations.invoiceId, invoiceId),
      ),
    )
    .orderBy(desc(paymentAllocations.createdAt));
}
