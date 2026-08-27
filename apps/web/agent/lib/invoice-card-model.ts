import type { Invoice } from "@invoicey/invoice-core/schema";
import type { DraftAssumption } from "@invoicey/invoice-tools";

import {
  ROUTINE_PATHS,
  copyFor,
  labelFor,
  reasonFor,
  type CardLocale,
} from "./invoice-card-i18n";

/**
 * Serializable description of one invoice Card.
 *
 * Built in three places — the create tool, the edit tool, and the Slack
 * interaction handler — and rendered in one (`slack-invoice-card.ts`). Keeping
 * it a plain data shape lets it round-trip through Eve's JSON channel state
 * and through a tool result without either side knowing about Block Kit.
 */
export interface InvoiceCardModel {
  kind: "invoice";
  /** Null only when the draft could not be persisted (no database). */
  invoiceId: string | null;
  title: string;
  subtitle: string;
  /** Lifecycle label driving which actions render. */
  state: InvoiceCardState;
  locale: CardLocale;
  fields: Array<{ label: string; value: string }>;
  /** Rendered line-item block, omitted when there is nothing useful to show. */
  linesText?: string;
  notice: CardNotice[];
  /**
   * Draft paths still standing on their default. Round-tripped through the
   * card's own controls so an edit to one field does not silently clear the
   * warnings on the others.
   */
  assumedPaths: string[];
  webUrl: string | null;
  fallbackText: string;
}

/** One line of the "we filled this in" / "check this" block. */
export interface CardNotice {
  kind: "default" | "suspect";
  label: string;
  value: string;
  reason: string;
}

export type InvoiceCardState =
  "draft" | "issued" | "paid" | "cancelled" | "readonly";

/** Czech-style money: `12 100,00 CZK`. */
export function formatMoney(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  /**
   * Intl groups thousands with a non-breaking space (U+00A0, and a narrow one
   * in some locales). Fold every Unicode space separator to a plain space so
   * the string is comparable and copy-pastes cleanly out of Slack.
   */
  return `${formatted.replace(/\p{Zs}/gu, " ")} ${currency}`;
}

function vatRateSummary(invoice: Invoice): string | null {
  const rates = [...new Set(invoice.items.map((item) => item.vatRate))].sort(
    (a, b) => b - a,
  );
  if (rates.length === 0) return null;
  return rates.map((rate) => `${rate} %`).join(", ");
}

function renderLines(invoice: Invoice, locale: CardLocale): string | undefined {
  if (invoice.items.length === 0) return undefined;
  const copy = copyFor(locale);
  const shown = invoice.items.slice(0, 5);
  const rows = shown.map((item) => {
    const unitPrice = formatMoney(
      item.unitPriceWithoutVat,
      invoice.meta.currency,
    );
    const lineTotal = formatMoney(item.lineSubtotal, invoice.meta.currency);
    return `${item.position}. ${item.description} · ${item.quantity} ${item.unit} × ${unitPrice} = ${lineTotal}`;
  });
  const hidden = invoice.items.length - shown.length;
  if (hidden > 0) rows.push(`_+${hidden} ${copy.text.moreLines}_`);
  return `*${copy.text.lines}* _(${copy.text.linesNote})_\n${rows.join("\n")}`;
}

const STATE_LABEL_KEYS = {
  draft: "draft",
  issued: "issued",
  paid: "paid",
  cancelled: "cancelled",
  readonly: "readonly",
} as const;

/**
 * Builds the full card model for one invoice.
 *
 * Every field a wrong guess could land in is shown, and any field still
 * standing on a server default is tagged in place — nothing reaches `issue`
 * without having been visible first.
 *
 * `assumptions` comes from the normalizer on a fresh draft. On a rebuild after
 * an edit the normalizer no longer knows what the user originally stated, so
 * `assumedPaths` is passed instead — recovered from the card's own controls.
 */
export function buildInvoiceCardModel(input: {
  invoice: Invoice;
  invoiceId: string | null;
  state: InvoiceCardState;
  assumptions?: readonly DraftAssumption[];
  assumedPaths?: readonly string[];
  webUrl?: string | null;
}): InvoiceCardModel {
  const { invoice, invoiceId, state } = input;
  const locale: CardLocale = invoice.meta.language === "en" ? "en" : "cs";
  const copy = copyFor(locale);
  const currency = invoice.meta.currency;

  const notice: CardNotice[] = [];
  const assumedPaths = new Set<string>();

  /** Current on-invoice value for a path, so a rebuilt notice quotes real data. */
  const valueForPath = (path: string): string => {
    switch (path) {
      case "meta.issueDate":
        return invoice.meta.issueDate;
      case "meta.dueDate":
        return invoice.meta.dueDate;
      case "meta.duzp":
        return invoice.meta.duzp;
      case "meta.language":
        return copy.language[locale];
      case "meta.currency":
        return currency;
      case "meta.docType":
        return copy.docType[invoice.meta.docType] ?? invoice.meta.docType;
      case "pricesIncludeVat":
        return copy.text.excludingVat;
      default:
        return `${copy.vatMode[invoice.vat.mode] ?? invoice.vat.mode} · ${copy.suppliesAbroad[invoice.vat.suppliesAbroad] ?? invoice.vat.suppliesAbroad}`;
    }
  };

  if (input.assumptions) {
    for (const assumption of input.assumptions) {
      if (assumption.kind !== "suspect") assumedPaths.add(assumption.path);
      if (assumption.severity === "routine") continue;
      notice.push({
        kind: assumption.kind,
        label: labelFor(assumption.path, locale) ?? assumption.label,
        /**
         * The normalizer's own `value` is English (it has no locale). Re-derive
         * it from the invoice so the notice does not read "Jazyk dokladu →
         * Czech" next to a field that says "čeština". A suspect's value is a
         * raw date the normalizer measured, so that one passes through.
         */
        value:
          assumption.kind === "suspect"
            ? assumption.value
            : valueForPath(assumption.path),
        /** A suspect's reason carries a computed day count; keep it verbatim. */
        reason:
          assumption.kind === "suspect"
            ? assumption.reason
            : (reasonFor(assumption.path, locale) ?? assumption.reason),
      });
    }
  } else if (input.assumedPaths) {
    for (const path of input.assumedPaths) assumedPaths.add(path);
  }

  /**
   * Rebuilt cards have no `assumptions` to read — the normalizer cannot tell,
   * after the fact, which values the user actually stated. The notice is
   * reconstructed from the carried paths instead, which is what keeps the
   * other warnings standing when one field is edited.
   */
  if (!input.assumptions) {
    for (const path of assumedPaths) {
      if (ROUTINE_PATHS.has(path)) continue;
      const label = labelFor(path, locale);
      const reason = reasonFor(path, locale);
      if (!label || !reason) continue;
      notice.push({
        kind: "default",
        label,
        value: valueForPath(path),
        reason,
      });
    }
  }

  const mark = (path: string, value: string): string =>
    assumedPaths.has(path) ? `${value}  ·  _${copy.text.assumedTag}_` : value;

  const vatRates = vatRateSummary(invoice);
  const fields: Array<{ label: string; value: string }> = [
    {
      label: copy.field.total,
      value: formatMoney(invoice.totals.total, currency),
    },
    {
      label: copy.field.subtotal,
      value: formatMoney(invoice.totals.subtotal, currency),
    },
    {
      label: copy.field.vat,
      value:
        invoice.totals.vatTotal === 0
          ? "—"
          : `${formatMoney(invoice.totals.vatTotal, currency)}${vatRates ? ` (${vatRates})` : ""}`,
    },
    { label: copy.field.currency, value: mark("meta.currency", currency) },
    {
      label: copy.field.issueDate,
      value: mark("meta.issueDate", invoice.meta.issueDate),
    },
    {
      label: copy.field.dueDate,
      value: mark("meta.dueDate", invoice.meta.dueDate),
    },
    {
      label: copy.field.vatTreatment,
      value: mark(
        assumedPaths.has("vat.mode") ? "vat.mode" : "vat",
        `${copy.vatMode[invoice.vat.mode] ?? invoice.vat.mode} · ${copy.suppliesAbroad[invoice.vat.suppliesAbroad] ?? invoice.vat.suppliesAbroad}`,
      ),
    },
    {
      label: copy.field.payment,
      value: copy.payment[invoice.payment.method] ?? invoice.payment.method,
    },
    {
      label: copy.field.language,
      value: mark("meta.language", copy.language[locale]),
    },
    {
      label: copy.field.priceBasis,
      value: mark("pricesIncludeVat", copy.text.excludingVat),
    },
  ];

  const stateLabel = copy.state[STATE_LABEL_KEYS[state]];
  const docTypeLabel =
    copy.docType[invoice.meta.docType] ?? invoice.meta.docType;

  /**
   * A draft's number is a `DRAFT-<timestamp>` placeholder replaced at issue, so
   * leading with it says nothing. The client identifies a draft to a person;
   * the real number only earns the headline once it exists.
   */
  const title =
    state === "draft"
      ? `${stateLabel} · ${invoice.client.name}`
      : `${invoice.meta.number} · ${invoice.client.name}`;
  const subtitle = [
    docTypeLabel,
    state === "draft" ? null : stateLabel,
    invoice.client.ico ? `IČO ${invoice.client.ico}` : null,
    formatMoney(invoice.totals.total, currency),
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");

  return {
    kind: "invoice",
    invoiceId,
    title,
    subtitle,
    state,
    locale,
    fields,
    linesText: renderLines(invoice, locale),
    notice,
    assumedPaths: [...assumedPaths],
    webUrl: input.webUrl ?? null,
    fallbackText: `${stateLabel} ${invoice.meta.number} · ${invoice.client.name} · ${formatMoney(invoice.totals.total, currency)}`,
  };
}

/** Maps a persisted summary's lifecycle flags onto a card state. */
export function cardStateFromSummary(summary: {
  issuedAt?: string | null;
  paidAt?: string | null;
  cancelledAt?: string | null;
}): InvoiceCardState {
  if (summary.cancelledAt) return "cancelled";
  if (summary.paidAt) return "paid";
  if (summary.issuedAt) return "issued";
  return "draft";
}
