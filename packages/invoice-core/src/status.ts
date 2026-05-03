import { fromZonedTime } from "date-fns-tz";

export const PRAGUE_TZ = "Europe/Prague";

export type InvoiceStatus =
	| "draft"
	| "issued"
	| "overdue"
	| "paid"
	| "cancelled";

export interface InvoiceFacts {
	issuedAt: Date | null;
	dueDate: Date;
	paidAt: Date | null;
	cancelledAt: Date | null;
}

/**
 * Due date is a calendar day; returns the UTC instant at end of that day (23:59:59.999)
 * in Europe/Prague.
 */
export function endOfDueDateInPrague(dueDate: Date): Date {
	const y = dueDate.getUTCFullYear();
	const mo = dueDate.getUTCMonth() + 1;
	const da = dueDate.getUTCDate();
	const wall = `${y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}T23:59:59.999`;
	return fromZonedTime(wall, PRAGUE_TZ);
}

export function deriveStatus(facts: InvoiceFacts, now: Date): InvoiceStatus {
	if (facts.cancelledAt !== null) {
		return "cancelled";
	}
	if (facts.issuedAt === null) {
		return "draft";
	}
	if (facts.paidAt !== null) {
		return "paid";
	}
	const dueEnd = endOfDueDateInPrague(facts.dueDate);
	if (now.getTime() > dueEnd.getTime()) {
		return "overdue";
	}
	return "issued";
}

/** Alias for persisted row shape — same as `deriveStatus`. */
export const deriveStatusFromInvoiceRow = deriveStatus;
