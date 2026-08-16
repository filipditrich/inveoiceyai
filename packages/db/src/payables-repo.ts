import { and, eq, sql } from "drizzle-orm";
import { derivePaymentState } from "@invoicey/payment-core/matcher";

import {
  incomingInvoices,
  payableMatchProposals,
  payablePaymentAllocations,
  paymentAuditEvents,
  paymentRunLines,
  paymentRuns,
} from "./schema";
import { withDbTransaction, type DbTransaction } from "./transaction";

export type PayableAllocationResult =
  | {
      ok: true;
      incomingInvoiceId: string;
      allocationId: string;
      paidAmount: string;
      paymentState: "unpaid" | "partial" | "paid" | "overpaid";
    }
  | { ok: false; error: string };

async function refreshPayableProjection(
  tx: DbTransaction,
  workspaceId: string,
  invoiceId: string,
) {
  const [invoice] = await tx
    .select({
      total: incomingInvoices.total,
      activePaymentRunId: incomingInvoices.activePaymentRunId,
    })
    .from(incomingInvoices)
    .where(
      and(
        eq(incomingInvoices.id, invoiceId),
        eq(incomingInvoices.workspaceId, workspaceId),
      ),
    )
    .for("update")
    .limit(1);
  if (!invoice) throw new Error("invoice_not_found");

  const [sumRow] = await tx
    .select({
      paidAmount: sql<string>`coalesce(sum(${payablePaymentAllocations.amount}) FILTER (WHERE ${payablePaymentAllocations.reversedAt} IS NULL), 0)::text`,
    })
    .from(payablePaymentAllocations)
    .where(
      and(
        eq(payablePaymentAllocations.incomingInvoiceId, invoiceId),
        eq(payablePaymentAllocations.workspaceId, workspaceId),
      ),
    );
  const paidAmount = sumRow?.paidAmount ?? "0";
  const projection = derivePaymentState({
    total: invoice.total ?? "0",
    allocated: paidAmount,
  });
  await tx
    .update(incomingInvoices)
    .set({
      paidAmount,
      paymentState: projection.state,
      updatedAt: new Date(),
    })
    .where(eq(incomingInvoices.id, invoiceId));

  if (invoice.activePaymentRunId && projection.state === "paid") {
    const openLines = await tx
      .select({
        id: paymentRunLines.id,
        incomingInvoiceId: paymentRunLines.incomingInvoiceId,
      })
      .from(paymentRunLines)
      .where(
        and(
          eq(paymentRunLines.paymentRunId, invoice.activePaymentRunId),
          eq(paymentRunLines.status, "submitted"),
        ),
      );
    const invoiceIds = openLines.map((line) => line.incomingInvoiceId);
    if (invoiceIds.length > 0) {
      const unpaid = await tx
        .select({ id: incomingInvoices.id })
        .from(incomingInvoices)
        .where(
          and(
            eq(incomingInvoices.workspaceId, workspaceId),
            sql`${incomingInvoices.id} in (${sql.join(
              invoiceIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
            sql`${incomingInvoices.paymentState} <> 'paid'`,
          ),
        );
      if (unpaid.length === 0) {
        await tx
          .update(paymentRuns)
          .set({ status: "closed", updatedAt: new Date() })
          .where(eq(paymentRuns.id, invoice.activePaymentRunId));
      }
    }
  }

  return { paidAmount, paymentState: projection.state };
}

async function addAuditEvent(
  tx: DbTransaction,
  input: {
    workspaceId: string;
    action: string;
    actorUserId?: string;
    entityType: string;
    entityId: string;
    payload?: Record<string, unknown>;
  },
) {
  await tx.insert(paymentAuditEvents).values({
    workspaceId: input.workspaceId,
    action: input.action,
    actorType: input.actorUserId ? "user" : "system",
    actorUserId: input.actorUserId,
    entityType: input.entityType,
    entityId: input.entityId,
    payloadJson: input.payload ?? {},
  });
}

export async function createManualPayableAllocation(input: {
  workspaceId: string;
  incomingInvoiceId: string;
  amount: string;
  effectiveDate: string;
  actorUserId?: string;
}): Promise<PayableAllocationResult> {
  try {
    return await withDbTransaction(async (tx) => {
      const [invoice] = await tx
        .select({
          id: incomingInvoices.id,
          currency: incomingInvoices.currency,
          status: incomingInvoices.status,
        })
        .from(incomingInvoices)
        .where(
          and(
            eq(incomingInvoices.id, input.incomingInvoiceId),
            eq(incomingInvoices.workspaceId, input.workspaceId),
          ),
        )
        .for("update")
        .limit(1);
      if (!invoice) return { ok: false, error: "invoice_not_found" };
      if (invoice.status !== "approved") {
        return { ok: false, error: "not_approved" };
      }
      const [allocation] = await tx
        .insert(payablePaymentAllocations)
        .values({
          workspaceId: input.workspaceId,
          incomingInvoiceId: input.incomingInvoiceId,
          source: "manual",
          amount: input.amount,
          currency: invoice.currency,
          effectiveDate: input.effectiveDate,
          confirmedByUserId: input.actorUserId,
        })
        .returning({ id: payablePaymentAllocations.id });
      if (!allocation) throw new Error("allocation_insert_failed");
      const projection = await refreshPayableProjection(
        tx,
        input.workspaceId,
        input.incomingInvoiceId,
      );
      await addAuditEvent(tx, {
        workspaceId: input.workspaceId,
        action: "allocation.created",
        actorUserId: input.actorUserId,
        entityType: "payable_payment_allocation",
        entityId: allocation.id,
      });
      return {
        ok: true,
        incomingInvoiceId: input.incomingInvoiceId,
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

export async function reversePayableAllocation(input: {
  workspaceId: string;
  allocationId: string;
  actorUserId: string;
  reason: string;
}): Promise<PayableAllocationResult> {
  try {
    return await withDbTransaction(async (tx) => {
      const [allocation] = await tx
        .select()
        .from(payablePaymentAllocations)
        .where(
          and(
            eq(payablePaymentAllocations.id, input.allocationId),
            eq(payablePaymentAllocations.workspaceId, input.workspaceId),
          ),
        )
        .for("update")
        .limit(1);
      if (!allocation) return { ok: false, error: "not_found" };
      if (allocation.reversedAt)
        return { ok: false, error: "already_reversed" };
      await tx
        .update(payablePaymentAllocations)
        .set({
          reversedAt: new Date(),
          reversedByUserId: input.actorUserId,
          reversalReason: input.reason,
        })
        .where(eq(payablePaymentAllocations.id, allocation.id));
      if (allocation.proposalId) {
        await tx
          .update(payableMatchProposals)
          .set({ status: "pending", updatedAt: new Date() })
          .where(eq(payableMatchProposals.id, allocation.proposalId));
      }
      const projection = await refreshPayableProjection(
        tx,
        input.workspaceId,
        allocation.incomingInvoiceId,
      );
      await addAuditEvent(tx, {
        workspaceId: input.workspaceId,
        action: "allocation.reversed",
        actorUserId: input.actorUserId,
        entityType: "payable_payment_allocation",
        entityId: allocation.id,
        payload: { reason: input.reason },
      });
      return {
        ok: true,
        incomingInvoiceId: allocation.incomingInvoiceId,
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

export async function confirmPayableMatchProposal(input: {
  workspaceId: string;
  proposalId: string;
  actorUserId: string;
}): Promise<PayableAllocationResult> {
  try {
    return await withDbTransaction(async (tx) => {
      const [proposal] = await tx
        .select()
        .from(payableMatchProposals)
        .where(
          and(
            eq(payableMatchProposals.id, input.proposalId),
            eq(payableMatchProposals.workspaceId, input.workspaceId),
          ),
        )
        .for("update")
        .limit(1);
      if (!proposal) return { ok: false, error: "proposal_not_found" };
      if (proposal.status !== "pending") {
        return { ok: false, error: "proposal_already_reviewed" };
      }
      const [allocation] = await tx
        .insert(payablePaymentAllocations)
        .values({
          workspaceId: input.workspaceId,
          incomingInvoiceId: proposal.incomingInvoiceId,
          bankTransactionId: proposal.bankTransactionId,
          proposalId: proposal.id,
          source: "bank_match",
          amount: proposal.proposedAmount,
          currency: proposal.proposedAmount
            ? await tx
                .select({ currency: incomingInvoices.currency })
                .from(incomingInvoices)
                .where(eq(incomingInvoices.id, proposal.incomingInvoiceId))
                .then((rows) => rows[0]?.currency ?? "CZK")
            : "CZK",
          effectiveDate: new Date().toISOString().slice(0, 10),
          confirmedByUserId: input.actorUserId,
        })
        .returning({ id: payablePaymentAllocations.id });
      if (!allocation) throw new Error("allocation_insert_failed");
      await tx
        .update(payableMatchProposals)
        .set({
          status: "confirmed",
          reviewedByUserId: input.actorUserId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payableMatchProposals.id, proposal.id));
      const projection = await refreshPayableProjection(
        tx,
        input.workspaceId,
        proposal.incomingInvoiceId,
      );
      return {
        ok: true,
        incomingInvoiceId: proposal.incomingInvoiceId,
        allocationId: allocation.id,
        ...projection,
      };
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "confirm_failed",
    };
  }
}
