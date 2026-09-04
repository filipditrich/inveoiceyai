export type DashboardAttentionKind =
  | "overdue"
  | "matches"
  | "drafts"
  | "unpaid";

export type DashboardAttentionAction = {
  kind: DashboardAttentionKind;
  count: number;
  totalsByCurrency: Record<string, number>;
  href: string;
};

export type InvoiceListParams = {
  status?: string;
  issuerId?: string;
  from?: string;
  to?: string;
};

export function invoicesListHref(params: InvoiceListParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/invoices?${query}` : "/invoices";
}

/**
 * Work the user can do right now. Independent of the dashboard period filter
 * so last year's overdue invoices still surface on a 2026 view.
 */
export function dashboardAttentionActions(input: {
  overdueCount: number;
  overdueTotals: Record<string, number>;
  unpaidCount: number;
  unpaidTotals: Record<string, number>;
  draftCount: number;
  pendingMatchCount: number;
  issuerId?: string;
}): DashboardAttentionAction[] {
  const issuerId = input.issuerId;
  const actions: DashboardAttentionAction[] = [];
  if (input.overdueCount > 0) {
    actions.push({
      kind: "overdue",
      count: input.overdueCount,
      totalsByCurrency: input.overdueTotals,
      href: invoicesListHref({ status: "overdue", issuerId }),
    });
  }
  if (input.pendingMatchCount > 0) {
    actions.push({
      kind: "matches",
      count: input.pendingMatchCount,
      totalsByCurrency: {},
      href: "/payments",
    });
  }
  if (input.draftCount > 0) {
    actions.push({
      kind: "drafts",
      count: input.draftCount,
      totalsByCurrency: {},
      href: invoicesListHref({ status: "draft", issuerId }),
    });
  }
  if (input.unpaidCount > 0) {
    actions.push({
      kind: "unpaid",
      count: input.unpaidCount,
      totalsByCurrency: input.unpaidTotals,
      href: invoicesListHref({ status: "unpaid", issuerId }),
    });
  }
  return actions;
}
