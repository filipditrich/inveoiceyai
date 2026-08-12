import {
  Actions,
  Card,
  Field,
  Fields,
  LinkButton,
  type CardChild,
  type CardElement,
} from "eve/channels/slack";

import type { PendingInvoiceCard } from "./slack-channel-extras";

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

/** Build an Eve Card from a pending invoice/list snapshot. */
export function buildInvoiceCard(pending: PendingInvoiceCard): CardElement {
  const children: CardChild[] = [
    Fields(
      pending.fields
        .slice(0, 8)
        .map((field) => Field({ label: field.label, value: field.value })),
    ),
  ];
  if (pending.webUrl) {
    children.push(
      Actions([
        LinkButton({
          url: pending.webUrl,
          label: "View in Invoicey",
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

export function invoiceCardFromCreateResult(output: {
  number?: unknown;
  clientName?: unknown;
  total?: unknown;
  currency?: unknown;
  invoiceId?: unknown;
  webUrl?: unknown;
}): PendingInvoiceCard | null {
  if (typeof output.number !== "string") return null;
  const number = output.number;
  const clientName =
    typeof output.clientName === "string" ? output.clientName : "—";
  const amount = formatInvoiceAmount(output.total, output.currency);
  const webUrl = typeof output.webUrl === "string" ? output.webUrl : null;
  return {
    kind: "invoice",
    title: number,
    subtitle: clientName,
    fields: [
      { label: "Status", value: "Draft" },
      { label: "Total", value: amount },
      { label: "Client", value: clientName },
    ],
    webUrl,
    fallbackText: `Draft ${number} · ${clientName} · ${amount}`,
  };
}

export function invoiceCardFromIssueResult(output: {
  number?: unknown;
  summary?: unknown;
  webUrl?: unknown;
  invoiceId?: unknown;
}): PendingInvoiceCard | null {
  const number =
    typeof output.number === "string"
      ? output.number
      : typeof (output.summary as { number?: unknown } | undefined)?.number ===
          "string"
        ? (output.summary as { number: string }).number
        : null;
  if (!number) return null;
  const summary =
    output.summary && typeof output.summary === "object"
      ? (output.summary as Record<string, unknown>)
      : {};
  const clientName =
    typeof summary.clientName === "string" ? summary.clientName : "—";
  const amount = formatInvoiceAmount(summary.total, summary.currency);
  const webUrl = typeof output.webUrl === "string" ? output.webUrl : null;
  return {
    kind: "invoice",
    title: number,
    subtitle: clientName,
    fields: [
      { label: "Status", value: "Issued" },
      { label: "Total", value: amount },
      { label: "Client", value: clientName },
    ],
    webUrl,
    fallbackText: `Issued ${number} · ${clientName} · ${amount}`,
  };
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
    title: number,
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
      return invoiceCardFromCreateResult(record);
    case "issue_invoice":
      return invoiceCardFromIssueResult(record);
    case "get_invoice":
      return invoiceCardFromGetResult(record);
    case "list_invoices":
      return invoiceCardFromListResult(record);
    case "mark_invoice_paid":
      return invoiceCardFromPaidResult(record);
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
