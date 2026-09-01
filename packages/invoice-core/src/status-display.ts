/** Display/filter buckets — orthogonal to domain `deriveStatus` (ADR 0014). */

export type InvoiceDisplayStatus =
  | "draft"
  | "unpaid"
  | "overdue"
  | "paid"
  | "future"
  | "cancelled";

export const INVOICE_DISPLAY_STATUSES: readonly InvoiceDisplayStatus[] = [
  "draft",
  "unpaid",
  "overdue",
  "paid",
  "future",
  "cancelled",
] as const;

export const DISPLAY_STATUS_LABELS: Record<InvoiceDisplayStatus, string> = {
  draft: "Návrh",
  unpaid: "Nezaplaceno",
  overdue: "Po splatnosti",
  paid: "Zaplaceno",
  future: "Budoucí",
  cancelled: "Stornováno",
};

export interface DisplayStatusInput {
  issuedAt: Date | null;
  /** Calendar due date YYYY-MM-DD (matches SQL filter compare). */
  dueDate: string;
  paidAt: Date | null;
  cancelledAt: Date | null;
  /** Calendar issue date YYYY-MM-DD. */
  issueDate: string;
}

/** Priority: cancelled → draft → paid → future → overdue → unpaid. */
export function resolveDisplayStatus(
  facts: DisplayStatusInput,
  todayIso: string,
): InvoiceDisplayStatus {
  if (facts.cancelledAt !== null) {
    return "cancelled";
  }
  if (facts.issuedAt === null) {
    return "draft";
  }
  if (facts.paidAt !== null) {
    return "paid";
  }
  if (facts.issueDate > todayIso) {
    return "future";
  }
  if (facts.dueDate < todayIso) {
    return "overdue";
  }
  return "unpaid";
}

/** Map legacy `?status=issued` query to display `unpaid`. */
export function normalizeDisplayStatusParam(
  raw: string | undefined | null,
): InvoiceDisplayStatus | null {
  if (!raw) {
    return null;
  }
  if (raw === "issued") {
    return "unpaid";
  }
  if ((INVOICE_DISPLAY_STATUSES as readonly string[]).includes(raw)) {
    return raw as InvoiceDisplayStatus;
  }
  return null;
}
