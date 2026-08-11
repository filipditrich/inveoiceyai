/** Czech locale money (MVP currency is always CZK). */
export function formatMoney(
	amount: number,
	currency: string = "CZK",
): string {
	return new Intl.NumberFormat("cs-CZ", {
		style: "currency",
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}

/** Format YYYY-MM-DD as Czech calendar date (e.g. 10. 8. 2026). */
export function formatDateCs(iso: string | null | undefined): string {
	if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
		return "—";
	}
	const d = new Date(`${iso}T12:00:00.000Z`);
	return new Intl.DateTimeFormat("cs-CZ", {
		day: "numeric",
		month: "numeric",
		year: "numeric",
		timeZone: "UTC",
	}).format(d);
}
