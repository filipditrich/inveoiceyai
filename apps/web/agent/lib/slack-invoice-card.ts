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
  type SelectElement,
} from "eve/channels/slack";

import type { PendingInvoiceCard } from "./slack-channel-extras";
import type { InvoiceCardModel } from "./invoice-card-model";
import {
  CURRENCY_OPTIONS,
  DUE_DATE_PRESETS,
  INVOICEY_ACTIONS,
  LANGUAGE_OPTIONS,
  VAT_OPTIONS,
  encodeSelectValue,
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
 * One-line summary of everything the normalizer guessed.
 *
 * The individual fields are already tagged inline; this block exists so the
 * reader gets the *reasons* in one place, and so the notice survives Slack's
 * field truncation.
 */
function assumptionsNotice(model: InvoiceCardModel): string | null {
  /**
   * Routine defaults (issue date is today, DUZP follows it) stay tagged on
   * their field but out of the warning. A notice that flags seven things flags
   * nothing — it is the two or three that could be wrong that need to stand out.
   */
  const notable = model.assumptions.filter(
    (assumption) => assumption.severity !== "routine",
  );
  if (notable.length === 0) return null;
  const rows = notable.map(
    (assumption) =>
      `• *${assumption.label}* → ${assumption.value}  _(${assumption.reason})_`,
  );
  return [
    ":warning: *Assumed — not stated by you.* Adjust below or just say what to change.",
    ...rows,
  ].join("\n");
}

function dueDatePresetValue(model: InvoiceCardModel): string | undefined {
  const issue = model.fields.find((f) => f.label === "Issue date")?.value;
  const due = model.fields.find((f) => f.label === "Due date")?.value;
  if (!issue || !due) return undefined;
  const issueMs = Date.parse(`${issue.slice(0, 10)}T12:00:00Z`);
  const dueMs = Date.parse(`${due.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(issueMs) || Number.isNaN(dueMs)) return undefined;
  const days = Math.round((dueMs - issueMs) / 86_400_000);
  return DUE_DATE_PRESETS.find((preset) => preset.days === days)?.value;
}

function currentFieldValue(
  model: InvoiceCardModel,
  label: string,
): string | undefined {
  const raw = model.fields.find((f) => f.label === label)?.value;
  if (!raw) return undefined;
  /** Strip the inline `assumed` tag so it can be matched against option values. */
  return raw.split("  ·  ")[0]?.trim();
}

/**
 * The adjust row: one click changes the field most likely to have been guessed
 * wrong, with no modal and no second turn of the model.
 */
function adjustActions(model: InvoiceCardModel): SelectElement[] {
  const invoiceId = model.invoiceId;
  if (!invoiceId) return [];

  const currency = currentFieldValue(model, "Currency");
  const language = currentFieldValue(model, "Language");
  const vat = currentFieldValue(model, "VAT treatment");
  const duePreset = dueDatePresetValue(model);

  const vatInitial = VAT_OPTIONS.find((option) => option.label === vat)?.value;

  return [
    Select({
      id: INVOICEY_ACTIONS.setDue,
      label: "Due date",
      placeholder: "Due date",
      ...(duePreset
        ? { initialOption: encodeSelectValue(invoiceId, duePreset) }
        : {}),
      options: DUE_DATE_PRESETS.map((preset) =>
        SelectOption({
          label: `Due ${preset.label}`,
          value: encodeSelectValue(invoiceId, preset.value),
        }),
      ),
    }),
    Select({
      id: INVOICEY_ACTIONS.setCurrency,
      label: "Currency",
      placeholder: "Currency",
      ...(currency
        ? { initialOption: encodeSelectValue(invoiceId, currency) }
        : {}),
      options: CURRENCY_OPTIONS.map((code) =>
        SelectOption({
          label: `Currency ${code}`,
          value: encodeSelectValue(invoiceId, code),
        }),
      ),
    }),
    Select({
      id: INVOICEY_ACTIONS.setVat,
      label: "VAT treatment",
      placeholder: "VAT treatment",
      ...(vatInitial
        ? { initialOption: encodeSelectValue(invoiceId, vatInitial) }
        : {}),
      options: VAT_OPTIONS.map((option) =>
        SelectOption({
          label: `VAT ${option.label}`,
          value: encodeSelectValue(invoiceId, option.value),
        }),
      ),
    }),
    Select({
      id: INVOICEY_ACTIONS.setLanguage,
      label: "Document language",
      placeholder: "Document language",
      ...(language
        ? {
            initialOption: encodeSelectValue(
              invoiceId,
              language === "English" ? "en" : "cs",
            ),
          }
        : {}),
      options: LANGUAGE_OPTIONS.map((option) =>
        SelectOption({
          label: `Language ${option.label}`,
          value: encodeSelectValue(invoiceId, option.value),
        }),
      ),
    }),
  ];
}

/** Primary row: what the user does next, sized to the invoice's lifecycle. */
function primaryActions(
  model: InvoiceCardModel,
): Array<ButtonElement | LinkButtonElement> {
  const invoiceId = model.invoiceId;
  const actions: Array<ButtonElement | LinkButtonElement> = [];

  if (invoiceId && model.state === "draft") {
    actions.push(
      Button({
        id: INVOICEY_ACTIONS.issue,
        label: "Issue invoice",
        style: "primary",
        value: invoiceId,
      }),
      Button({
        id: INVOICEY_ACTIONS.previewPdf,
        label: "Preview PDF",
        value: invoiceId,
      }),
    );
  }

  if (invoiceId && (model.state === "issued" || model.state === "paid")) {
    if (model.state === "issued") {
      actions.push(
        Button({
          id: INVOICEY_ACTIONS.markPaid,
          label: "Mark paid",
          style: "primary",
          value: invoiceId,
        }),
      );
    }
    actions.push(
      Button({
        id: INVOICEY_ACTIONS.sendEmail,
        label: "Send to client",
        value: invoiceId,
      }),
      Button({
        id: INVOICEY_ACTIONS.previewPdf,
        label: "Get PDF",
        value: invoiceId,
      }),
    );
  }

  if (model.webUrl) {
    actions.push(
      LinkButton({
        id: INVOICEY_ACTIONS.openWeb,
        url: model.webUrl,
        label: "Open in Invoicey",
      }),
    );
  }

  if (invoiceId && model.state === "draft") {
    actions.push(
      Button({
        id: INVOICEY_ACTIONS.discard,
        label: "Discard",
        style: "danger",
        value: invoiceId,
      }),
    );
  }

  return actions;
}

/** Renders one invoice card model into an Eve Card, controls included. */
export function buildInvoiceModelCard(model: InvoiceCardModel): CardElement {
  const children: CardChild[] = [
    Fields(
      model.fields
        .slice(0, MAX_CARD_FIELDS)
        .map((field) => Field({ label: field.label, value: field.value })),
    ),
  ];

  if (model.linesText) {
    children.push(CardText(model.linesText));
  }

  const notice = assumptionsNotice(model);
  if (notice) {
    children.push(Divider());
    children.push(CardText(notice));
  }

  const primary = primaryActions(model);
  if (primary.length > 0) {
    children.push(Divider());
    children.push(Actions(primary));
  }

  const adjust = model.state === "draft" ? adjustActions(model) : [];
  if (adjust.length > 0) {
    children.push(Actions(adjust));
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
          label: "Open in Invoicey",
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
      { label: "Status", value: displayStatus },
      { label: "Total", value: amount },
      { label: "Client", value: clientName },
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
    return {
      label: number,
      value: `${client} · ${amount} · ${status}`,
    };
  });
  const more =
    output.invoices.length > rows.length
      ? ` (+${output.invoices.length - rows.length} more)`
      : "";
  return {
    kind: "list",
    title: `Invoices${more}`,
    subtitle: `${output.invoices.length} shown`,
    fields,
    webUrl: null,
    fallbackText: `Invoices: ${fields.map((f) => `${f.label} ${f.value}`).join("; ")}`,
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
    title: `Paid · ${number}`,
    subtitle: clientName,
    fields: [
      { label: "Status", value: "Paid" },
      { label: "Total", value: amount },
      { label: "Client", value: clientName },
    ],
    webUrl: null,
    fallbackText: `Paid ${number} · ${clientName} · ${amount}`,
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
          title: "Email sent",
          fields: [
            { label: "Status", value: "Sent" },
            ...(to ? [{ label: "To", value: to }] : []),
          ],
          webUrl,
          fallbackText: to
            ? `Invoice email sent to ${to}`
            : "Invoice email sent",
        };
      }
      return {
        ...base,
        fields: [
          { label: "Status", value: "Email sent" },
          ...(to ? [{ label: "To", value: to }] : []),
          ...base.fields.filter((f) => f.label !== "Status"),
        ],
        fallbackText: `Email sent · ${base.fallbackText}`,
      };
    }
    default:
      return null;
  }
}
