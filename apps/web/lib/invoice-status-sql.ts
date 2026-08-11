import { invoices } from "@invoicey/db";
import type { InvoiceDisplayStatus } from "@invoicey/invoice-core/status-display";
import type { InvoiceStatus } from "@invoicey/invoice-core/status";
import { and, gte, gt, isNotNull, isNull, lt, lte, type SQL } from "drizzle-orm";

/** Prague calendar "today" as YYYY-MM-DD for due-date text compare. */
export function pragueTodayIso(): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Prague",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}

/** SQL predicate matching domain `deriveStatus` facts (ADR 0014). */
export function statusWhere(
	status: InvoiceStatus,
	todayIso: string,
): SQL | undefined {
	switch (status) {
		case "draft":
			return and(isNull(invoices.issuedAt), isNull(invoices.cancelledAt));
		case "cancelled":
			return isNotNull(invoices.cancelledAt);
		case "paid":
			return and(isNotNull(invoices.paidAt), isNull(invoices.cancelledAt));
		case "overdue":
			return and(
				isNotNull(invoices.issuedAt),
				isNull(invoices.paidAt),
				isNull(invoices.cancelledAt),
				lt(invoices.dueDate, todayIso),
			);
		case "issued":
			return and(
				isNotNull(invoices.issuedAt),
				isNull(invoices.paidAt),
				isNull(invoices.cancelledAt),
				gte(invoices.dueDate, todayIso),
			);
		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}

/** SQL predicate matching `resolveDisplayStatus` (FO filter keys). */
export function displayStatusWhere(
	status: InvoiceDisplayStatus,
	todayIso: string,
): SQL | undefined {
	switch (status) {
		case "draft":
			return and(isNull(invoices.issuedAt), isNull(invoices.cancelledAt));
		case "cancelled":
			return isNotNull(invoices.cancelledAt);
		case "paid":
			return and(isNotNull(invoices.paidAt), isNull(invoices.cancelledAt));
		case "future":
			return and(
				isNotNull(invoices.issuedAt),
				isNull(invoices.paidAt),
				isNull(invoices.cancelledAt),
				gt(invoices.issueDate, todayIso),
			);
		case "overdue":
			return and(
				isNotNull(invoices.issuedAt),
				isNull(invoices.paidAt),
				isNull(invoices.cancelledAt),
				lte(invoices.issueDate, todayIso),
				lt(invoices.dueDate, todayIso),
			);
		case "unpaid":
			return and(
				isNotNull(invoices.issuedAt),
				isNull(invoices.paidAt),
				isNull(invoices.cancelledAt),
				lte(invoices.issueDate, todayIso),
				gte(invoices.dueDate, todayIso),
			);
		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}
