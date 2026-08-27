import {
  Actions,
  Button,
  Card,
  CardText,
  Divider,
  Field,
  Fields,
  LinkButton,
  Select,
  SelectOption,
  type ButtonElement,
  type CardChild,
  type CardElement,
  type LinkButtonElement,
  type SelectOptionElement,
} from "eve/channels/slack";

import { copyFor } from "./invoice-card-i18n";
import type { InvoiceCardModel } from "./invoice-card-model";
import type { PendingInvoiceCard } from "./slack-channel-extras";
import {
  CURRENCY_OPTIONS,
  DUE_DATE_PRESETS,
  INVOICEY_ACTIONS,
  LANGUAGE_OPTIONS,
  VAT_OPTIONS,
  encodeButtonValue,
  encodeChangeValue,
} from "./slack-invoice-actions";

/** Slack renders at most 10 fields in one section. */
const MAX_CARD_FIELDS = 10;

/** Format tool totals that may be a number (invoice-core) or a string (DB summary). */
export function formatInvoiceAmount(total: unknown, currency: unknown): string {
  let amount = "—";
  if (typeof total === "number" && Number.isFinite(total)) {
    amount = String(total);
  } else if (typeof total === "string" && total.trim().length > 0) {
    amount = total.trim();
  }
  const cur = typeof currency === "string" ? currency.trim() : "";
  if (amount === "—" || cur.length === 0) return amount;
  return `${amount} ${cur}`;
}

/**
 * Everything still standing on a default, with its reason.
 *
 * Suspects lead: a value that looks invented is worse than one we defaulted,
 * and the two should not read as the same kind of note.
 */
function noticeText(model: InvoiceCardModel): string | null {
  if (model.notice.length === 0) return null;
  const copy = copyFor(model.locale);
  const suspects = model.notice.filter((entry) => entry.kind === "suspect");
  const defaults = model.notice.filter((entry) => entry.kind !== "suspect");

  const lines: string[] = [];
  const render = (entry: (typeof model.notice)[number]): string =>
    `• *${entry.label}* → ${entry.value}  _(${entry.reason})_`;

  if (suspects.length > 0) {
    lines.push(copy.text.suspectHeading, ...suspects.map(render));
  }
  if (defaults.length > 0) {
    lines.push(copy.text.assumedHeading, ...defaults.map(render));
  }
  return lines.join("\n");
}

/**
 * One menu holding every draft adjustment.
 *
 * Four separate selects each got a quarter of the actions row and collapsed to
 * a single letter in a Slack thread pane. A lone select spans the row, and the
 * option labels already name their field, so the merge costs nothing.
 */
function changeOptions(model: InvoiceCardModel): SelectOptionElement[] {
  const invoiceId = model.invoiceId;
  if (!invoiceId) return [];
  const copy = copyFor(model.locale);
  const assumedPaths = model.assumedPaths;

  const option = (
    field: Parameters<typeof encodeChangeValue>[0]["field"],
    value: string,
    label: string,
  ): SelectOptionElement =>
    SelectOption({
      label,
      value: encodeChangeValue({ invoiceId, assumedPaths, field, value }),
    });

  return [
    ...DUE_DATE_PRESETS.map((preset) =>
      option(
        "d",
        preset.value,
        `${copy.option.due} ${preset.days} ${copy.option.days}`,
      ),
    ),
    ...CURRENCY_OPTIONS.map((code) =>
      option("c", code, `${copy.option.currency} ${code}`),
    ),
    ...VAT_OPTIONS.map((vat) =>
      option(
        "v",
        vat.value,
        `${copy.option.vat} ${copy.vatMode[vat.mode] ?? vat.mode} · ${copy.suppliesAbroad[vat.suppliesAbroad] ?? vat.suppliesAbroad}`,
      ),
    ),
    ...LANGUAGE_OPTIONS.map((code) =>
      option("l", code, `${copy.option.language} ${copy.language[code]}`),
    ),
  ];
}

/** Primary row: what the user does next, sized to the invoice's lifecycle. */
function primaryActions(
  model: InvoiceCardModel,
): Array<ButtonElement | LinkButtonElement> {
  const invoiceId = model.invoiceId;
  const copy = copyFor(model.locale);
  const actions: Array<ButtonElement | LinkButtonElement> = [];
  const value = invoiceId
    ? encodeButtonValue(invoiceId, model.assumedPaths)
    : "";

  if (invoiceId && model.state === "draft") {
    actions.push(
      Button({
        id: INVOICEY_ACTIONS.issue,
        label: copy.action.issue,
        style: "primary",
        value,
      }),
      Button({
        id: INVOICEY_ACTIONS.previewPdf,
        label: copy.action.previewPdf,
        value,
      }),
    );
  }

  if (invoiceId && (model.state === "issued" || model.state === "paid")) {
    if (model.state === "issued") {
      actions.push(
        Button({
          id: INVOICEY_ACTIONS.markPaid,
          label: copy.action.markPaid,
          style: "primary",
          value,
        }),
      );
    }
    actions.push(
      Button({
        id: INVOICEY_ACTIONS.sendEmail,
        label: copy.action.sendEmail,
        value,
      }),
      Button({
        id: INVOICEY_ACTIONS.previewPdf,
        label: copy.action.getPdf,
        value,
      }),
    );
  }

  if (model.webUrl) {
    actions.push(
      LinkButton({
        id: INVOICEY_ACTIONS.openWeb,
        url: model.webUrl,
        label: copy.action.openWeb,
      }),
    );
  }

  if (invoiceId && model.state === "draft") {
    actions.push(
      Button({
        id: INVOICEY_ACTIONS.discard,
        label: copy.action.discard,
        style: "danger",
        value,
      }),
    );
  }

  return actions;
}

/** Renders one invoice card model into an Eve Card, controls included. */
export function buildInvoiceModelCard(model: InvoiceCardModel): CardElement {
  const copy = copyFor(model.locale);
  const children: CardChild[] = [
    Fields(
      model.fields
        .slice(0, MAX_CARD_FIELDS)
        .map((field) => Field({ label: field.label, value: field.value })),
    ),
  ];

  if (model.linesText) children.push(CardText(model.linesText));

  const notice = noticeText(model);
  if (notice) {
    children.push(Divider());
    children.push(CardText(notice));
  }

  const primary = primaryActions(model);
  if (primary.length > 0) {
    children.push(Divider());
    children.push(Actions(primary));
  }

  const options = model.state === "draft" ? changeOptions(model) : [];
  if (options.length > 0) {
    children.push(
      Actions([
        Select({
          id: INVOICEY_ACTIONS.change,
          label: copy.action.change,
          placeholder: copy.action.change,
          options,
        }),
      ]),
    );
  }

  return Card({ title: model.title, subtitle: model.subtitle, children });
}

/** Build an Eve Card from a pending invoice/list snapshot. */
export function buildInvoiceCard(pending: PendingInvoiceCard): CardElement {
  if (pending.model) return buildInvoiceModelCard(pending.model);

  const children: CardChild[] = [
    Fields(
      pending.fields
        .slice(0, MAX_CARD_FIELDS)
        .map((field) => Field({ label: field.label, value: field.value })),
    ),
  ];
  if (pending.webUrl) {
    children.push(
      Actions([
        LinkButton({
          url: pending.webUrl,
          label: "Otevřít v Invoicey",
          style: "primary",
        }),
      ]),
    );
  }
  return Card({
    title: pending.title,
    subtitle: pending.subtitle,
    children,
  });
}

function pendingFromModel(model: InvoiceCardModel): PendingInvoiceCard {
  return {
    kind: "invoice",
    title: model.title,
    subtitle: model.subtitle,
    fields: model.fields,
    webUrl: model.webUrl,
    fallbackText: model.fallbackText,
    model,
  };
}

/** Reads the `card` model a tool attached to its own result. */
function modelFromToolOutput(output: {
  card?: unknown;
}): PendingInvoiceCard | null {
  const card = output.card;
  if (!card || typeof card !== "object") return null;
  const candidate = card as Partial<InvoiceCardModel>;
  if (candidate.kind !== "invoice" || typeof candidate.title !== "string") {
    return null;
  }
  return pendingFromModel(card as InvoiceCardModel);
}

export function invoiceCardFromGetResult(output: {
  summary?: unknown;
  webUrl?: unknown;
}): PendingInvoiceCard | null {
  if (!output.summary || typeof output.summary !== "object") return null;
  const summary = output.summary as Record<string, unknown>;
  const number = typeof summary.number === "string" ? summary.number : "—";
  const clientName =
    typeof summary.clientName === "string" ? summary.clientName : "—";
  const displayStatus =
    typeof summary.displayStatus === "string"
      ? summary.displayStatus
      : typeof summary.status === "string"
        ? summary.status
        : "—";
  const amount = formatInvoiceAmount(summary.total, summary.currency);
  const webUrl = typeof output.webUrl === "string" ? output.webUrl : null;
  return {
    kind: "invoice",
    title: number,
    subtitle: clientName,
    fields: [
      { label: "Stav", value: displayStatus },
      { label: "Celkem", value: amount },
      { label: "Klient", value: clientName },
    ],
    webUrl,
    fallbackText: `${number} · ${clientName} · ${amount} · ${displayStatus}`,
  };
}

export function invoiceCardFromListResult(output: {
  invoices?: unknown;
}): PendingInvoiceCard | null {
  if (!Array.isArray(output.invoices) || output.invoices.length === 0) {
    return null;
  }
  const rows = output.invoices
    .filter(
      (row): row is Record<string, unknown> => !!row && typeof row === "object",
    )
    .slice(0, 5);
  if (rows.length === 0) return null;
  const fields = rows.map((row) => {
    const number = typeof row.number === "string" ? row.number : "—";
    const client = typeof row.clientName === "string" ? row.clientName : "—";
    const status =
      typeof row.displayStatus === "string"
        ? row.displayStatus
        : typeof row.status === "string"
          ? row.status
          : "—";
    const amount = formatInvoiceAmount(row.total, row.currency);
    return { label: number, value: `${client} · ${amount} · ${status}` };
  });
  const more =
    output.invoices.length > rows.length
      ? ` (+${output.invoices.length - rows.length})`
      : "";
  return {
    kind: "list",
    title: `Faktury${more}`,
    subtitle: `${output.invoices.length}`,
    fields,
    webUrl: null,
    fallbackText: `Faktury: ${fields.map((f) => `${f.label} ${f.value}`).join("; ")}`,
  };
}

export function invoiceCardFromPaidResult(output: {
  summary?: unknown;
  id?: unknown;
}): PendingInvoiceCard | null {
  if (!output.summary || typeof output.summary !== "object") return null;
  const summary = output.summary as Record<string, unknown>;
  const number = typeof summary.number === "string" ? summary.number : "—";
  const clientName =
    typeof summary.clientName === "string" ? summary.clientName : "—";
  const amount = formatInvoiceAmount(summary.total, summary.currency);
  return {
    kind: "invoice",
    title: `Zaplaceno · ${number}`,
    subtitle: clientName,
    fields: [
      { label: "Stav", value: "Zaplaceno" },
      { label: "Celkem", value: amount },
      { label: "Klient", value: clientName },
    ],
    webUrl: null,
    fallbackText: `Zaplaceno ${number} · ${clientName} · ${amount}`,
  };
}

export function pendingCardFromToolResult(
  toolName: string,
  output: unknown,
): PendingInvoiceCard | null {
  if (!output || typeof output !== "object") return null;
  const record = output as Record<string, unknown>;
  if (record.ok !== true) return null;
  switch (toolName) {
    case "create_invoice":
    case "update_invoice_draft":
    case "issue_invoice":
      return modelFromToolOutput(record);
    case "get_invoice":
      return modelFromToolOutput(record) ?? invoiceCardFromGetResult(record);
    case "list_invoices":
      return invoiceCardFromListResult(record);
    case "mark_invoice_paid":
      return modelFromToolOutput(record) ?? invoiceCardFromPaidResult(record);
    case "send_invoice_email": {
      const to = typeof record.to === "string" ? record.to : null;
      const webUrl = typeof record.webUrl === "string" ? record.webUrl : null;
      const base = invoiceCardFromGetResult({
        summary: record.summary,
        webUrl,
      });
      if (!base) {
        return {
          kind: "invoice",
          title: "Odesláno",
          fields: [
            { label: "Stav", value: "Odesláno" },
            ...(to ? [{ label: "Komu", value: to }] : []),
          ],
          webUrl,
          fallbackText: to ? `Faktura odeslána na ${to}` : "Faktura odeslána",
        };
      }
      return {
        ...base,
        fields: [
          { label: "Stav", value: "Odesláno" },
          ...(to ? [{ label: "Komu", value: to }] : []),
          ...base.fields.filter((f) => f.label !== "Stav"),
        ],
        fallbackText: `Odesláno · ${base.fallbackText}`,
      };
    }
    default:
      return null;
  }
}
