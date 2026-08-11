import type { InvoiceDisplayStatus } from "@invoicey/invoice-core/status-display";

export const DISPLAY_STATUS_BADGE_CLASS: Record<InvoiceDisplayStatus, string> =
	{
		paid: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
		draft: "border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-400",
		unpaid:
			"border-transparent bg-orange-500/15 text-orange-700 dark:text-orange-400",
		overdue: "border-transparent bg-red-500/15 text-red-700 dark:text-red-400",
		future:
			"border-transparent bg-violet-500/15 text-violet-700 dark:text-violet-400",
		cancelled: "border-transparent bg-muted text-muted-foreground",
	};

export const DISPLAY_STATUS_ROW_ACCENT: Record<InvoiceDisplayStatus, string> = {
	paid: "border-l-4 border-l-emerald-500",
	draft: "border-l-4 border-l-sky-500",
	unpaid: "border-l-4 border-l-orange-500",
	overdue: "border-l-4 border-l-red-500",
	future: "border-l-4 border-l-violet-500",
	cancelled: "border-l-4 border-l-muted-foreground/40",
};

export const DISPLAY_STATUS_CARD_ACCENT: Record<InvoiceDisplayStatus, string> = {
	paid: "text-emerald-700 dark:text-emerald-400",
	draft: "text-sky-700 dark:text-sky-400",
	unpaid: "text-orange-700 dark:text-orange-400",
	overdue: "text-red-700 dark:text-red-400",
	future: "text-violet-700 dark:text-violet-400",
	cancelled: "text-muted-foreground",
};
