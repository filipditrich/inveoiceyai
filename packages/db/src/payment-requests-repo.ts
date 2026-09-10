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

function allocatedAmountSql() {
  return sql<string>`coalesce(sum(${paymentAllocations.amount}) FILTER (WHERE ${paymentAllocations.reversedAt} IS NULL), 0)::text`;
}

export async function loadPaymentRequest(
  database: Pick<DbTransaction, "select">,
  workspaceId: string,
  requestId: string,
): Promise<PaymentRequestWithProgress | null> {
  const [row] = await database
    .select({
      request: paymentRequests,
      allocatedAmount: allocatedAmountSql(),
    })
    .from(paymentRequests)
    .leftJoin(
      paymentAllocations,
      eq(paymentAllocations.paymentRequestId, paymentRequests.id),
    )
    .where(
      and(
        eq(paymentRequests.id, requestId),
        eq(paymentRequests.workspaceId, workspaceId),
      ),
    )
    .groupBy(paymentRequests.id)
    .limit(1);
  if (!row) return null;
  return { ...row.request, allocatedAmount: row.allocatedAmount };
}

export async function loadPaymentRequestByPublicToken(
  database: Pick<DbTransaction, "select">,
  token: string,
): Promise<PaymentRequestWithProgress | null> {
  const [row] = await database
    .select({
      request: paymentRequests,
      allocatedAmount: allocatedAmountSql(),
    })
    .from(paymentRequests)
    .leftJoin(
      paymentAllocations,
      eq(paymentAllocations.paymentRequestId, paymentRequests.id),
    )
    .where(eq(paymentRequests.publicToken, token))
    .groupBy(paymentRequests.id)
    .limit(1);
  if (!row) return null;
  return { ...row.request, allocatedAmount: row.allocatedAmount };
}

function paymentRequestScope(
  workspaceId: string,
  status?: "open" | "settled" | "cancelled",
) {
  if (status) {
    return and(
      eq(paymentRequests.workspaceId, workspaceId),
      eq(paymentRequests.status, status),
    );
  }
  return eq(paymentRequests.workspaceId, workspaceId);
}

export async function countPaymentRequests(
  database: Pick<DbTransaction, "select">,
  workspaceId: string,
  status?: "open" | "settled" | "cancelled",
): Promise<number> {
  const [row] = await database
    .select({ total: sql<number>`count(*)::int` })
    .from(paymentRequests)
    .where(paymentRequestScope(workspaceId, status));
  return row?.total ?? 0;
}

export async function listPaymentRequests(
  database: Pick<DbTransaction, "select">,
  workspaceId: string,
  paging?: {
    limit: number;
    offset: number;
    status?: "open" | "settled" | "cancelled";
  },
): Promise<PaymentRequestWithProgress[]> {
  const query = database
    .select({
      request: paymentRequests,
      allocatedAmount: allocatedAmountSql(),
    })
    .from(paymentRequests)
    .leftJoin(
      paymentAllocations,
      eq(paymentAllocations.paymentRequestId, paymentRequests.id),
    )
    .where(paymentRequestScope(workspaceId, paging?.status))
    .groupBy(paymentRequests.id)
    .orderBy(desc(paymentRequests.createdAt));
  const rows = paging
    ? await query.limit(paging.limit).offset(paging.offset)
    : await query;
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
      allocatedAmount: allocatedAmountSql(),
    })
    .from(paymentRequests)
    .leftJoin(
      paymentAllocations,
      eq(paymentAllocations.paymentRequestId, paymentRequests.id),
    )
    .where(
      and(
        eq(paymentRequests.workspaceId, input.workspaceId),
        eq(paymentRequests.bankAccountId, input.bankAccountId),
      ),
    )
    .groupBy(paymentRequests.id);
  return rows.map((row) => ({
    ...row.request,
    allocatedAmount: row.allocatedAmount,
  }));
}
