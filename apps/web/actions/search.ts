"use server";

import { requireWorkspace } from "@/lib/auth/session";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { clients, invoices } from "@invoicey/db";
import { db } from "@invoicey/db/client";

export type QuickSearchResult = {
  invoices: {
    id: string;
    number: string | null;
    clientName: string;
    total: string;
    currency: string;
    issueDate: string;
  }[];
  clients: {
    id: string;
    name: string;
    ico: string | null;
  }[];
};

const EMPTY: QuickSearchResult = { invoices: [], clients: [] };
const PER_KIND = 6;

/**
 * Backs the ⌘K palette. Deliberately narrow — invoice number, client name, and
 * IČO are what people actually type when they are looking for one record.
 */
export async function quickSearchAction(
  query: string,
): Promise<QuickSearchResult> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return EMPTY;
  }

  const { workspaceId } = await requireWorkspace();
  const pattern = `%${trimmed}%`;
  const digits = trimmed.replace(/\D/g, "");

  const [invoiceRows, clientRows] = await Promise.all([
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        clientName: invoices.clientName,
        total: invoices.total,
        currency: invoices.currency,
        issueDate: invoices.issueDate,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.workspaceId, workspaceId),
          or(
            ilike(invoices.number, pattern),
            ilike(invoices.clientName, pattern),
          ),
        ),
      )
      .orderBy(desc(invoices.issueDate))
      .limit(PER_KIND),
    db
      .select({
        id: clients.id,
        snapshot: clients.snapshot,
      })
      .from(clients)
      .where(
        and(
          eq(clients.workspaceId, workspaceId),
          or(
            sql`${clients.snapshot}->>'name' ILIKE ${pattern}`,
            digits.length >= 2
              ? sql`regexp_replace(coalesce(${clients.snapshot}->>'ico', ''), '\\D', '', 'g') LIKE ${`%${digits}%`}`
              : sql`false`,
          ),
        ),
      )
      .orderBy(desc(clients.updatedAt))
      .limit(PER_KIND),
  ]);

  return {
    invoices: invoiceRows,
    clients: clientRows.map((row) => {
      const snapshot = row.snapshot as { name?: unknown; ico?: unknown };
      return {
        id: row.id,
        name: typeof snapshot.name === "string" ? snapshot.name : "—",
        ico: typeof snapshot.ico === "string" ? snapshot.ico : null,
      };
    }),
  };
}
