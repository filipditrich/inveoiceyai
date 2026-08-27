import { formatVatIntent, type DraftAssumption } from "@invoicey/invoice-tools";
import type { Invoice } from "@invoicey/invoice-core/schema";

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
  fields: Array<{ label: string; value: string }>;
  /** Rendered line-item block, omitted when there is nothing useful to show. */
  linesText?: string;
  assumptions: DraftAssumption[];
  webUrl: string | null;
  fallbackText: string;
}

export type InvoiceCardState =
  "draft" | "issued" | "paid" | "cancelled" | "readonly";

/** Marks a value the user never supplied, so the card can flag it inline. */
const ASSUMED_SUFFIX = "  ·  _assumed_";

const LANGUAGE_LABELS: Record<string, string> = {
  cs: "Czech",
  en: "English",
};

const PAYMENT_LABELS: Record<string, string> = {
  transfer: "Bank transfer",
  cash: "Cash",
  card: "Card",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  invoice: "Invoice",
  proforma: "Proforma",
  advance: "Advance",
  credit_note: "Credit note",
};

/** Czech-style money: `12 100,00 CZK`. */
export function formatMoney(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  /** Normalize the various no-break spaces Intl emits so tests stay stable. */
  return `${formatted.replace(/[  ]/gu, " ")} ${currency}`;
}

/** `NFCtron a.s. · IČO 08453961` */
export function clientLine(invoice: Invoice): string {
  const parts = [invoice.client.name];
  if (invoice.client.ico) parts.push(`IČO ${invoice.client.ico}`);
  return parts.join(" · ");
}

function assumedPaths(assumptions: readonly DraftAssumption[]): Set<string> {
  return new Set(assumptions.map((a) => a.path));
}

function vatRateSummary(invoice: Invoice): string | null {
  const rates = [...new Set(invoice.items.map((item) => item.vatRate))].sort(
    (a, b) => b - a,
  );
  if (rates.length === 0) return null;
  return rates.map((rate) => `${rate} %`).join(", ");
}

/** Up to five lines as `1. Web development · 10 hod × 1 000,00 = 10 000,00`. */
function renderLines(invoice: Invoice): string | undefined {
  if (invoice.items.length === 0) return undefined;
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
  if (hidden > 0) rows.push(`_+${hidden} more line(s)_`);
  return `*Lines* _(excl. VAT)_\n${rows.join("\n")}`;
}

/**
 * Builds the full card model for one invoice.
 *
 * Every field a wrong guess could land in is shown, and any field the
 * normalizer filled in itself is tagged `assumed` in place — the point is that
 * nothing reaches `issue` without having been visible first.
 */
export function buildInvoiceCardModel(input: {
  invoice: Invoice;
  invoiceId: string | null;
  state: InvoiceCardState;
  assumptions?: readonly DraftAssumption[];
  webUrl?: string | null;
}): InvoiceCardModel {
  const { invoice, invoiceId, state } = input;
  const assumptions = [...(input.assumptions ?? [])];
  const assumed = assumedPaths(assumptions);
  const currency = invoice.meta.currency;

  const mark = (path: string, value: string): string =>
    assumed.has(path) ? `${value}${ASSUMED_SUFFIX}` : value;

  const vatRates = vatRateSummary(invoice);
  const fields: Array<{ label: string; value: string }> = [
    {
      label: "Total",
      value: formatMoney(invoice.totals.total, currency),
    },
    {
      label: "Excl. VAT",
      value: formatMoney(invoice.totals.subtotal, currency),
    },
    {
      label: "VAT",
      value:
        invoice.totals.vatTotal === 0
          ? "—"
          : `${formatMoney(invoice.totals.vatTotal, currency)}${vatRates ? ` (${vatRates})` : ""}`,
    },
    {
      label: "Currency",
      value: mark("meta.currency", currency),
    },
    {
      label: "Issue date",
      value: mark("meta.issueDate", invoice.meta.issueDate),
    },
    {
      label: "Due date",
      value: mark("meta.dueDate", invoice.meta.dueDate),
    },
    {
      label: "VAT treatment",
      value: mark(
        assumed.has("vat.mode") ? "vat.mode" : "vat",
        formatVatIntent(invoice.vat),
      ),
    },
    {
      label: "Payment",
      value: PAYMENT_LABELS[invoice.payment.method] ?? invoice.payment.method,
    },
    {
      label: "Language",
      value: mark(
        "meta.language",
        LANGUAGE_LABELS[invoice.meta.language] ?? invoice.meta.language,
      ),
    },
    {
      label: "Line prices",
      value: mark("pricesIncludeVat", "excluding VAT"),
    },
  ];

  const docTypeLabel =
    DOC_TYPE_LABELS[invoice.meta.docType] ?? invoice.meta.docType;
  const stateLabel = STATE_LABELS[state];

  /**
   * A draft's number is a `DRAFT-<timestamp>` placeholder that is replaced at
   * issue, so leading with it says nothing. The client is what identifies a
   * draft to a person; the real number only earns the headline once it exists.
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
    fields,
    linesText: renderLines(invoice),
    assumptions,
    webUrl: input.webUrl ?? null,
    fallbackText: `${stateLabel} ${invoice.meta.number} · ${invoice.client.name} · ${formatMoney(invoice.totals.total, currency)}`,
  };
}

const STATE_LABELS: Record<InvoiceCardState, string> = {
  draft: "Draft",
  issued: "Issued",
  paid: "Paid",
  cancelled: "Cancelled",
  readonly: "Invoice",
};

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
