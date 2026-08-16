import type { AppLocale } from "@/i18n/config";
import { toIntlLocale } from "@/i18n/config";

/** Format one or more currency totals (never mix into a single CZK figure). */
export function formatMoneyByCurrency(
  totalsByCurrency: Record<string, number>,
  locale: AppLocale = "cs",
): string {
  const entries = Object.entries(totalsByCurrency);
  if (entries.length === 0) {
    return formatMoney(0, "CZK", locale);
  }
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, total]) => formatMoney(total, currency, locale))
    .join(" · ");
}

/** Locale-aware money. */
export function formatMoney(
  amount: number,
  currency: string = "CZK",
  locale: AppLocale = "cs",
): string {
  return new Intl.NumberFormat(toIntlLocale(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Amount + ISO code once — never `CZK 12,100.00 CZK`. */
export function formatMoneyCode(
  amount: number,
  currency: string = "CZK",
  locale: AppLocale = "cs",
): string {
  const formatted = new Intl.NumberFormat(toIntlLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} ${currency}`;
}

/**
 * Format YYYY-MM-DD as a calendar date in the active locale
 * (e.g. cs → `10. 8. 2026`, en → `10/08/2026`).
 */
export function formatInvoiceDate(
  iso: string | null | undefined,
  locale: AppLocale = "cs",
  empty = "—",
): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return empty;
  }
  const d = new Date(`${iso}T12:00:00.000Z`);
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** @deprecated Prefer {@link formatInvoiceDate}. */
export function formatDateCs(
  iso: string | null | undefined,
  locale: AppLocale = "cs",
): string {
  return formatInvoiceDate(iso, locale);
}

/** Date+time for security / email timelines. */
export function formatDateTime(
  value: Date | string | number,
  locale: AppLocale = "cs",
  timeZone = "Europe/Prague",
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(d);
}
