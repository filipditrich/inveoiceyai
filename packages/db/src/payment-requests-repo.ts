import { and, desc, eq, sql } from "drizzle-orm";

import { invoices, paymentAllocations, paymentRequests } from "./schema";
import { type DbTransaction } from "./transaction";

export type PaymentRequestRow = typeof paymentRequests.$inferSelect;

export type PaymentRequestWithProgress = PaymentRequestRow & {
  allocatedAmount: string;
};

export async function isPaymentSymbolTaken(
  database: Pick<DbTransaction, "select">,
  input: { bankAccountId: string; iban: string; symbol: string },
): Promise<boolean> {
  const [hit] = await database
    .select({ taken: sql<number>`1` })
    .from(paymentRequests)
    .where(
      and(
        eq(paymentRequests.bankAccountId, input.bankAccountId),
        eq(paymentRequests.variableSymbol, input.symbol),
      ),
    )
    .limit(1);
  if (hit) return true;

  const [invoiceHit] = await database
    .select({ taken: sql<number>`1` })
    .from(invoices)
    .where(
      and(
        eq(invoices.paymentAccountIban, input.iban),
        eq(invoices.paymentVariableSymbol, input.symbol),
      ),
    )
    .limit(1);
  return Boolean(invoiceHit);
}

export async function loadPaymentRequest(
  database: Pick<DbTransaction, "select">,
  workspaceId: string,
  requestId: string,
): Promise<PaymentRequestWithProgress | null> {
  const [row] = await database
    .select({
      request: paymentRequests,
      allocatedAmount: sql<string>`coalesce((
        select sum(${paymentAllocations.amount})
        from ${paymentAllocations}
        where ${paymentAllocations.paymentRequestId} = ${paymentRequests.id}
          and ${paymentAllocations.reversedAt} is null
      ), 0)::text`,
    })
    .from(paymentRequests)
    .where(
      and(
        eq(paymentRequests.id, requestId),
        eq(paymentRequests.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!row) return null;
  return { ...row.request, allocatedAmount: row.allocatedAmount };
}

export async function loadPaymentRequestByPublicToken(
  database: Pick<DbTransaction, "select">,
  token: string,
): Promise<PaymentRequestRow | null> {
  const [row] = await database
    .select()
    .from(paymentRequests)
    .where(eq(paymentRequests.publicToken, token))
    .limit(1);
  return row ?? null;
}

export async function listPaymentRequests(
  database: Pick<DbTransaction, "select">,
  workspaceId: string,
): Promise<PaymentRequestWithProgress[]> {
  const rows = await database
    .select({
      request: paymentRequests,
      allocatedAmount: sql<string>`coalesce((
        select sum(${paymentAllocations.amount})
        from ${paymentAllocations}
        where ${paymentAllocations.paymentRequestId} = ${paymentRequests.id}
          and ${paymentAllocations.reversedAt} is null
      ), 0)::text`,
    })
    .from(paymentRequests)
    .where(eq(paymentRequests.workspaceId, workspaceId))
    .orderBy(desc(paymentRequests.createdAt));
  return rows.map((row) => ({
    ...row.request,
    allocatedAmount: row.allocatedAmount,
  }));
}

export async function listOpenPaymentRequestsForAccount(
  database: Pick<DbTransaction, "select">,
  input: { workspaceId: string; bankAccountId: string },
): Promise<PaymentRequestWithProgress[]> {
  const rows = await database
    .select({
      request: paymentRequests,
      allocatedAmount: sql<string>`coalesce((
        select sum(${paymentAllocations.amount})
        from ${paymentAllocations}
        where ${paymentAllocations.paymentRequestId} = ${paymentRequests.id}
          and ${paymentAllocations.reversedAt} is null
      ), 0)::text`,
    })
    .from(paymentRequests)
    .where(
      and(
        eq(paymentRequests.workspaceId, input.workspaceId),
        eq(paymentRequests.bankAccountId, input.bankAccountId),
      ),
    );
  return rows.map((row) => ({
    ...row.request,
    allocatedAmount: row.allocatedAmount,
  }));
}
