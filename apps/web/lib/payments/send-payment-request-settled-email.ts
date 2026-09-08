import "server-only";
import { eq } from "drizzle-orm";

import { paymentRequests, user } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { renderPaymentRequestSettledEmail } from "@invoicey/emails";
import { sendTransactionalEmail } from "@invoicey/invoice-tools/email";

import { listPaymentNotificationRecipients } from "./notify-recipients";

function appOrigin(): string {
  return (
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/u, "");
}

export async function sendPaymentRequestSettledEmail(input: {
  workspaceId: string;
  requestId: string;
  amount: string;
  bookedDate: string;
  variableSymbol: string | null;
}): Promise<void> {
  const [request] = await db
    .select({
      id: paymentRequests.id,
      message: paymentRequests.message,
      variableSymbol: paymentRequests.variableSymbol,
      createdByUserId: paymentRequests.createdByUserId,
    })
    .from(paymentRequests)
    .where(eq(paymentRequests.id, input.requestId))
    .limit(1);
  if (!request) return;

  const recipients = await listPaymentNotificationRecipients({
    workspaceId: input.workspaceId,
    permission: "payments:read",
  });
  const unique = new Map(recipients.map((row) => [row.userId, row]));
  if (request.createdByUserId && !unique.has(request.createdByUserId)) {
    const [creator] = await db
      .select({ name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, request.createdByUserId))
      .limit(1);
    if (creator?.email) {
      unique.set(request.createdByUserId, {
        userId: request.createdByUserId,
        name: creator.name ?? "",
        email: creator.email,
      });
    }
  }

  const origin = appOrigin();
  const amountLabel = new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
  }).format(Number(input.amount));
  const bookedDate = new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeZone: "Europe/Prague",
  }).format(new Date(`${input.bookedDate}T12:00:00.000Z`));

  await Promise.all(
    [...unique.values()].map(async (recipient) => {
      if (!recipient.email) return;
      const rendered = await renderPaymentRequestSettledEmail({
        userName: recipient.name,
        amountLabel,
        bookedDate,
        variableSymbol: input.variableSymbol ?? request.variableSymbol,
        note: request.message,
        requestUrl: `${origin}/payments/requests/${request.id}`,
        paymentsUrl: `${origin}/payments`,
        locale: "cs",
      });
      await sendTransactionalEmail({
        db,
        workspaceId: input.workspaceId,
        template: "payment_request_settled",
        to: recipient.email,
        displayName: "Invoicey",
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        createdBy: recipient.userId,
      });
    }),
  );
}
