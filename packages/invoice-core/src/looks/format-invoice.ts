import type { InvoiceLabels } from "../labels";
import type { Invoice, InvoiceCurrency, InvoiceLanguage } from "../schema";
import { currencyDisplaySuffix } from "../schema";

export function formatInvoiceMoneyAmount(n: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatInvoiceMoneyWithCurrency(
  n: number,
  currency: InvoiceCurrency,
  locale: string,
  language: InvoiceLanguage,
): string {
  return `${formatInvoiceMoneyAmount(n, locale)}\u00a0${currencyDisplaySuffix(currency, language)}`;
}

export function formatInvoiceDateIsoLocal(
  dateIso: string,
  locale: string,
): string {
  const value = new Date(dateIso);
  if (Number.isNaN(value.getTime())) {
    return dateIso;
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function calendarIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${String(year)}-${mm}-${dd}`;
}

/** Accept ISO or D.M.YYYY / D/M/YYYY (spaces allowed). Null until a real calendar day. */
export function parseInvoiceDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(trimmed);
  if (iso) {
    return calendarIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  const compact = trimmed.replace(/\s/gu, "");
  const dotted = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/u.exec(compact);
  if (!dotted) return null;
  return calendarIso(Number(dotted[3]), Number(dotted[2]), Number(dotted[1]));
}

export function formatInvoiceQty(n: number, locale: string): string {
  const s = n.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
  return s.replaceAll(",", " ");
}

export function formatIbanDisplay(iban: string): string {
  const clean = iban.replace(/\s/g, "");
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    chunks.push(clean.slice(i, i + 4));
  }
  return chunks.join("\u00a0");
}

export function paymentMethodLabel(
  method: Invoice["payment"]["method"],
  labels: InvoiceLabels,
): string {
  switch (method) {
    case "transfer":
      return labels.payTransfer;
    case "cash":
      return labels.payCashShort;
    case "card":
      return labels.payCardShort;
    default: {
      const _never: never = method;
      return _never;
    }
  }
}

export function countryHuman(code: string, labels: InvoiceLabels): string {
  return code === "CZ" ? labels.countryCz : code;
}

export function postalCityLine(zip: string, city: string): string {
  return `${zip} ${city}`;
}

export function splitDescription(raw: string): {
  title: string;
  detail?: string;
} {
  const idx = raw.indexOf("\n");
  if (idx === -1) {
    return { title: raw };
  }
  const title = raw.slice(0, idx).trim();
  const rest = raw.slice(idx + 1).trim();
  return { title: title.length > 0 ? title : raw, detail: rest || undefined };
}
