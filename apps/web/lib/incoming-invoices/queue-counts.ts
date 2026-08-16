import { incomingInvoices } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { eq } from "drizzle-orm";

export type IncomingQueueCounts = {
  review: number;
  approval: number;
  pay: number;
  all: number;
};

export function incomingQueueCountsFromRows(
  rows: Array<{
    status: string;
    paymentState: string;
    docType: string;
  }>,
): IncomingQueueCounts {
  return {
    review: rows.filter((row) =>
      ["needs_review", "extract_failed", "on_hold"].includes(row.status),
    ).length,
    approval: rows.filter((row) => row.status === "pending_approval").length,
    pay: rows.filter(
      (row) =>
        row.status === "approved" &&
        row.paymentState !== "paid" &&
        row.docType !== "credit_note",
    ).length,
    all: rows.length,
  };
}

export async function loadIncomingQueueCounts(
  workspaceId: string,
): Promise<IncomingQueueCounts> {
  const rows = await db
    .select({
      status: incomingInvoices.status,
      paymentState: incomingInvoices.paymentState,
      docType: incomingInvoices.docType,
    })
    .from(incomingInvoices)
    .where(eq(incomingInvoices.workspaceId, workspaceId));
  return incomingQueueCountsFromRows(rows);
}
