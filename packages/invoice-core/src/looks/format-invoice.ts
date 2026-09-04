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
