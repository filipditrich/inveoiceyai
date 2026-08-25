import { invoices } from "@invoicey/db";
import {
  asc,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lte,
  or,
  type SQL,
} from "drizzle-orm";

import type { InvoiceSort } from "@/lib/invoices/list-sort";

export const DEFAULT_PAGE_SIZE = 50;
export const PAGE_SIZES = [25, 50, 100] as const;

export function invoiceOrderBy(sort: InvoiceSort): SQL[] {
  const dir = sort.desc ? desc : asc;
  switch (sort.id) {
    case "issueDate":
      return [dir(invoices.issueDate), desc(invoices.createdAt)];
    case "dueDate":
      return [dir(invoices.dueDate), desc(invoices.createdAt)];
    case "clientName":
      return [dir(invoices.clientName), desc(invoices.createdAt)];
    case "total":
      return [dir(invoices.total), desc(invoices.createdAt)];
    case "number":
      return [dir(invoices.number), desc(invoices.createdAt)];
    default: {
      const _exhaustive: never = sort.id;
      return _exhaustive;
    }
  }
}

export function buildInvoiceBaseConditions(
  workspaceId: string,
  sp: {
    issuerId?: string | null;
    clientId?: string | null;
    q?: string | null;
    from?: string | null;
    to?: string | null;
    originProvider?: string | null;
  },
): SQL[] {
  const conditions: SQL[] = [eq(invoices.workspaceId, workspaceId)];
  if (sp.issuerId) {
    conditions.push(eq(invoices.issuerId, sp.issuerId));
  }
  if (sp.clientId) {
    conditions.push(eq(invoices.clientId, sp.clientId));
  }
  if (sp.from) {
    conditions.push(gte(invoices.issueDate, sp.from));
  }
  if (sp.to) {
    conditions.push(lte(invoices.issueDate, sp.to));
  }
  if (sp.originProvider) {
    if (sp.originProvider === "invoicey") {
      conditions.push(
        or(
          isNull(invoices.originProvider),
          eq(invoices.originProvider, "invoicey"),
        )!,
      );
    } else {
      conditions.push(eq(invoices.originProvider, sp.originProvider));
    }
  }
  if (sp.q?.trim()) {
    const q = `%${sp.q.trim()}%`;
    conditions.push(
      or(
        ilike(invoices.number, q),
        ilike(invoices.clientName, q),
        ilike(invoices.notes, q),
      )!,
    );
  }
  return conditions;
}

export function parsePage(raw?: string | null): number {
  return Math.max(1, Number(raw ?? "1") || 1);
}

export function parsePageSize(raw?: string | null): number {
  const n = Number(raw ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}
