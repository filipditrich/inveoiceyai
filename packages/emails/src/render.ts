import { render } from "@react-email/render";

import {
  InvoiceSentEmail,
  type InvoiceSentEmailProps,
} from "./templates/invoice-sent";
import {
  OverdueReminderEmail,
  type OverdueReminderEmailProps,
} from "./templates/overdue-reminder";
import {
  PaymentReceivedEmail,
  type PaymentReceivedEmailProps,
} from "./templates/payment-received";
import {
  WorkspaceInviteEmail,
  type WorkspaceInviteEmailProps,
} from "./templates/workspace-invite";

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export const EMAIL_TEMPLATES = [
  "invoice_sent",
  "workspace_invite",
  "overdue_reminder",
  "payment_received",
] as const;

export type EmailTemplateId = (typeof EMAIL_TEMPLATES)[number];

export async function renderInvoiceSentEmail(
  props: InvoiceSentEmailProps,
): Promise<RenderedEmail> {
  const element = InvoiceSentEmail(props);
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return {
    subject: `Faktura ${props.number} — ${props.issuerName}`,
    html,
    text,
  };
}

export async function renderWorkspaceInviteEmail(
  props: WorkspaceInviteEmailProps,
): Promise<RenderedEmail> {
  const element = WorkspaceInviteEmail(props);
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return {
    subject: `Pozvánka do ${props.workspaceName}`,
    html,
    text,
  };
}

export async function renderOverdueReminderEmail(
  props: OverdueReminderEmailProps,
): Promise<RenderedEmail> {
  const element = OverdueReminderEmail(props);
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return {
    subject: `Připomínka: faktura ${props.number}`,
    html,
    text,
  };
}

export async function renderPaymentReceivedEmail(
  props: PaymentReceivedEmailProps,
): Promise<RenderedEmail> {
  const element = PaymentReceivedEmail(props);
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return {
    subject: `Platba přijata — ${props.number}`,
    html,
    text,
  };
}
