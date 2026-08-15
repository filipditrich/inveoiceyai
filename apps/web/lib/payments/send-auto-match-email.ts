import "server-only";

import { invoices, user } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { renderBankPaymentAutoMatchedEmail } from "@invoicey/emails";
import { InvoiceSchema } from "@invoicey/invoice-core/schema";
import { sendTransactionalEmail } from "@invoicey/invoice-tools/email";
import { and, eq } from "drizzle-orm";

function appOrigin(): string {
  return (
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/u, "");
}

export async function sendAutoMatchOwnerEmail(input: {
  workspaceId: string;
  userId: string;
  invoiceId: string;
  amount: string;
  bookedDate: string;
  variableSymbol: string | null;
}): Promise<void> {
  const [invoice] = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      clientName: invoices.clientName,
      currency: invoices.currency,
      payloadJson: invoices.payloadJson,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.id, input.invoiceId),
        eq(invoices.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  const [recipient] = await db
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1);
  if (!invoice || !recipient?.email) return;

  const parsed = InvoiceSchema.safeParse(invoice.payloadJson);
  const locale = parsed.success ? parsed.data.meta.language : "cs";
  const intlLocale = locale === "cs" ? "cs-CZ" : "en-US";
  const origin = appOrigin();
  const rendered = await renderBankPaymentAutoMatchedEmail({
    userName: recipient.name,
    invoiceNumber: invoice.number ?? "—",
    clientName: invoice.clientName,
    amountLabel: new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: invoice.currency,
    }).format(Number(input.amount)),
    bookedDate: new Intl.DateTimeFormat(intlLocale, {
      dateStyle: "medium",
      timeZone: "Europe/Prague",
    }).format(new Date(`${input.bookedDate}T12:00:00.000Z`)),
    variableSymbol: input.variableSymbol,
    invoiceUrl: `${origin}/invoices/${invoice.id}`,
    paymentsUrl: `${origin}/payments`,
    locale,
  });

  await sendTransactionalEmail({
    db,
    workspaceId: input.workspaceId,
    template: "bank_payment_auto_matched",
    to: recipient.email,
    displayName: "Invoicey",
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    invoiceId: invoice.id,
    createdBy: input.userId,
  });
}
