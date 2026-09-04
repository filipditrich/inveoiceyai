import { render } from "@react-email/render";

import { invoiceEmailCopy, systemEmailCopy } from "./copy";
import {
  BankPaymentAutoMatchedEmail,
  type BankPaymentAutoMatchedEmailProps,
} from "./templates/bank-payment-auto-matched";
import {
  GuestInvoiceEmail,
  type GuestInvoiceEmailProps,
} from "./templates/guest-invoice";
import {
  InvoiceSentEmail,
  type InvoiceSentEmailProps,
} from "./templates/invoice-sent";
import {
  NewSignInEmail,
  type NewSignInEmailProps,
} from "./templates/new-sign-in";
import {
  OverdueReminderEmail,
  type OverdueReminderEmailProps,
} from "./templates/overdue-reminder";
import {
  PaymentReceivedEmail,
  type PaymentReceivedEmailProps,
} from "./templates/payment-received";
import {
  TokenRewardEmail,
  type TokenRewardEmailProps,
} from "./templates/token-reward";
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
  "bank_payment_auto_matched",
  "new_sign_in",
  "token_reward",
  "guest_invoice",
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
    subject: invoiceEmailCopy(props.locale ?? "cs").sentSubject(
      props.number,
      props.issuerName,
    ),
    html,
    text,
  };
}

export async function renderGuestInvoiceEmail(
  props: GuestInvoiceEmailProps,
): Promise<RenderedEmail> {
  const element = GuestInvoiceEmail(props);
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return {
    subject: invoiceEmailCopy(props.locale ?? "cs").guestSubject(props.number),
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
  const locale = props.locale ?? "cs";
  const copy = systemEmailCopy(locale);
  const expiryNote = props.expiresAtLabel
    ? copy.inviteExpiryNote(props.expiresAtLabel)
    : "";
  return {
    subject: copy.inviteSubject(props.workspaceName, expiryNote),
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
    subject: invoiceEmailCopy(props.locale ?? "cs").overdueSubject(
      props.number,
    ),
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
    subject: invoiceEmailCopy(props.locale ?? "cs").paidSubject(props.number),
    html,
    text,
  };
}

export async function renderNewSignInEmail(
  props: NewSignInEmailProps,
): Promise<RenderedEmail> {
  const element = NewSignInEmail(props);
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return {
    subject: systemEmailCopy(props.locale ?? "cs").signInSubject,
    html,
    text,
  };
}

export async function renderTokenRewardEmail(
  props: TokenRewardEmailProps,
): Promise<RenderedEmail> {
  const element = TokenRewardEmail(props);
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return {
    subject: systemEmailCopy(props.locale ?? "cs").tokenRewardSubject,
    html,
    text,
  };
}

export async function renderBankPaymentAutoMatchedEmail(
  props: BankPaymentAutoMatchedEmailProps,
): Promise<RenderedEmail> {
  const element = BankPaymentAutoMatchedEmail(props);
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return {
    subject:
      (props.locale ?? "cs") === "cs"
        ? `Platba spárována — ${props.invoiceNumber}`
        : `Payment matched — ${props.invoiceNumber}`,
    html,
    text,
  };
}
