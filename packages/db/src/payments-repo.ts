import { and, desc, eq, isNull, sql } from "drizzle-orm";

import {
  bankTransactions,
  invoicePaymentAllocations,
  invoices,
  paymentAuditEvents,
  paymentMatchProposals,
} from "./schema";
import { withDbTransaction, type DbTransaction } from "./transaction";

export type PaymentState = "unpaid" | "partial" | "paid" | "overpaid";

export type AllocationMutationResult =
  | {
      ok: true;
      invoiceId: string;
      allocationId: string;
      paidAmount: string;
      paymentState: PaymentState;
      becamePaid: boolean;
    }
  | { ok: false; error: string };

function stateSql() {
  return sql<PaymentState>`CASE
    WHEN coalesce(sum(${invoicePaymentAllocations.amount}) FILTER (WHERE ${invoicePaymentAllocations.reversedAt} IS NULL), 0) <= 0 THEN 'unpaid'
    WHEN coalesce(sum(${invoicePaymentAllocations.amount}) FILTER (WHERE ${invoicePaymentAllocations.reversedAt} IS NULL), 0) < abs(${invoices.total}) THEN 'partial'
    WHEN coalesce(sum(${invoicePaymentAllocations.amount}) FILTER (WHERE ${invoicePaymentAllocations.reversedAt} IS NULL), 0) = abs(${invoices.total}) THEN 'paid'
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
      paidAmount: sql<string>`coalesce(sum(${invoicePaymentAllocations.amount}) FILTER (WHERE ${invoicePaymentAllocations.reversedAt} IS NULL), 0)::text`,
      paymentState: stateSql(),
    })
    .from(invoices)
    .leftJoin(
      invoicePaymentAllocations,
      and(
        eq(invoicePaymentAllocations.invoiceId, invoices.id),
        eq(invoicePaymentAllocations.workspaceId, workspaceId),
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
        .insert(invoicePaymentAllocations)
        .values({
          workspaceId: input.workspaceId,
          invoiceId: input.invoiceId,
          source: "manual",
          amount: input.amount,
          currency: invoice.currency,
          effectiveDate: input.effectiveDate,
          confirmedByUserId: input.actorUserId,
        })
        .returning({ id: invoicePaymentAllocations.id });
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
  actorUserId: string;
}): Promise<AllocationMutationResult> {
  try {
    return await withDbTransaction(async (tx) => {
      const [proposal] = await tx
        .select({
          id: paymentMatchProposals.id,
          invoiceId: paymentMatchProposals.invoiceId,
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
      const [transactionUsage] = await tx
        .select({
          allocated: sql<string>`coalesce(sum(${invoicePaymentAllocations.amount}), 0)::text`,
        })
        .from(invoicePaymentAllocations)
        .where(
          and(
            eq(
              invoicePaymentAllocations.bankTransactionId,
              proposal.bankTransactionId,
            ),
            isNull(invoicePaymentAllocations.reversedAt),
          ),
        );
      if (
        Number(transactionUsage?.allocated ?? 0) + Number(proposal.amount) >
        Number(proposal.transactionAmount)
      ) {
        return { ok: false, error: "transaction_amount_exhausted" };
      }

      const [allocation] = await tx
        .insert(invoicePaymentAllocations)
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
        .returning({ id: invoicePaymentAllocations.id });
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
        actorType: "user",
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
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "confirmation_failed",
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
          id: invoicePaymentAllocations.id,
          invoiceId: invoicePaymentAllocations.invoiceId,
        })
        .from(invoicePaymentAllocations)
        .where(
          and(
            eq(invoicePaymentAllocations.id, input.allocationId),
            eq(invoicePaymentAllocations.workspaceId, input.workspaceId),
            isNull(invoicePaymentAllocations.reversedAt),
          ),
        )
        .for("update")
        .limit(1);
      if (!allocation) return { ok: false, error: "allocation_not_found" };
      await tx
        .update(invoicePaymentAllocations)
        .set({
          reversedAt: new Date(),
          reversedByUserId: input.actorUserId,
          reversalReason: input.reason?.trim() || null,
        })
        .where(eq(invoicePaymentAllocations.id, allocation.id));
      const projection = await refreshInvoicePaymentProjection(
        tx,
        input.workspaceId,
        allocation.invoiceId,
      );
      await addAuditEvent(tx, {
        workspaceId: input.workspaceId,
        action: "allocation.reversed",
        actorType: input.actorUserId ? "user" : "system",
        actorUserId: input.actorUserId,
        entityType: "invoice_payment_allocation",
        entityId: allocation.id,
        payload: { reason: input.reason ?? null },
      });
      return {
        ok: true,
        invoiceId: allocation.invoiceId,
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
        .select({ id: invoicePaymentAllocations.id })
        .from(invoicePaymentAllocations)
        .where(
          and(
            eq(invoicePaymentAllocations.workspaceId, input.workspaceId),
            eq(invoicePaymentAllocations.invoiceId, input.invoiceId),
            isNull(invoicePaymentAllocations.reversedAt),
          ),
        )
        .for("update");
      if (active.length === 0)
        return { ok: false, error: "no_active_allocations" };
      const now = new Date();
      await tx
        .update(invoicePaymentAllocations)
        .set({
          reversedAt: now,
          reversedByUserId: input.actorUserId,
          reversalReason: input.reason ?? "Marked unpaid",
        })
        .where(
          and(
            eq(invoicePaymentAllocations.workspaceId, input.workspaceId),
            eq(invoicePaymentAllocations.invoiceId, input.invoiceId),
            isNull(invoicePaymentAllocations.reversedAt),
          ),
        );
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
    .from(invoicePaymentAllocations)
    .where(
      and(
        eq(invoicePaymentAllocations.workspaceId, workspaceId),
        eq(invoicePaymentAllocations.invoiceId, invoiceId),
      ),
    )
    .orderBy(desc(invoicePaymentAllocations.createdAt));
}
