import "server-only";
import { eq } from "drizzle-orm";

import { invoices } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { renderGuestInvoiceEmail } from "@invoicey/emails";
import {
  invoiceArtifactFileNamesFromInvoice,
  renderInvoicePdf,
  toInvoiceIntlLocale,
  type Invoice,
} from "@invoicey/invoice-core";

import { isEmailConfigured } from "./client";
import { sendTransactionalEmail, type EmailAttachment } from "./send";

function formatTotalLabel(
  total: string | number,
  currency: string,
  language: Invoice["meta"]["language"],
): string {
  const n = typeof total === "number" ? total : Number(total);
  const formatted = new Intl.NumberFormat(toInvoiceIntlLocale(language), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
  return `${formatted} ${currency}`;
}

async function pdfAttachment(invoice: Invoice, pdfUrl: string | null) {
  const names = invoiceArtifactFileNamesFromInvoice(invoice);
  const content = pdfUrl
    ? Buffer.from(
        await (async () => {
          const res = await fetch(pdfUrl);
          if (!res.ok) {
            throw new Error(`Failed to fetch attachment (${res.status})`);
          }
          return res.arrayBuffer();
        })(),
      )
    : Buffer.from(await renderInvoicePdf(invoice));
  const attachment: EmailAttachment = {
    filename: names.pdf,
    content,
    contentType: "application/pdf",
  };
  return attachment;
}

/**
 * Transactional guest-invoice mail (ADR 0048 §5, §6). System From — Invoicey
 * talking to a visitor, not the issuer talking to their client.
 */
export async function sendGuestInvoiceEmail(input: {
  workspaceId: string;
  invoiceId: string;
  invoice: Invoice;
  to: string;
  claimUrl: string;
  downloadUrl: string;
}): Promise<{ ok: boolean }> {
  if (!isEmailConfigured()) {
    return { ok: false };
  }

  const [row] = await db
    .select({ pdfUrl: invoices.pdfUrl, total: invoices.total })
    .from(invoices)
    .where(eq(invoices.id, input.invoiceId))
    .limit(1);

  const locale = input.invoice.meta.language;
  const rendered = await renderGuestInvoiceEmail({
    number: input.invoice.meta.number,
    issueDate: input.invoice.meta.issueDate,
    dueDate: input.invoice.meta.dueDate,
    totalLabel: formatTotalLabel(
      row?.total ?? input.invoice.totals.total,
      input.invoice.meta.currency,
      locale,
    ),
    clientName: input.invoice.client.name,
    issuerName: input.invoice.issuer.name,
    claimUrl: input.claimUrl,
    downloadUrl: input.downloadUrl,
    locale,
  });

  try {
    await sendTransactionalEmail({
      db,
      workspaceId: input.workspaceId,
      template: "guest_invoice",
      to: input.to,
      displayName: "Invoicey",
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      invoiceId: input.invoiceId,
      attachPdf: true,
      attachments: [await pdfAttachment(input.invoice, row?.pdfUrl ?? null)],
    });
    return { ok: true };
  } catch (error) {
    console.error("[invoicey] guest invoice mail failed", error);
    return { ok: false };
  }
}
