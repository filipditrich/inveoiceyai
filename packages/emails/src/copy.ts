export type EmailLocale = "cs" | "en";

export function isEmailLocale(
  value: string | undefined | null,
): value is EmailLocale {
  return value === "cs" || value === "en";
}

export function emailLocale(value: string | undefined | null): EmailLocale {
  return isEmailLocale(value) ? value : "cs";
}

type InvoiceEmailCopy = {
  sentTitle: (number: string) => string;
  sentPreview: (number: string, issuerName: string) => string;
  sentSubject: (number: string, issuerName: string) => string;
  defaultCover: string;
  overdueTitle: (number: string) => string;
  overduePreview: (number: string) => string;
  overdueSubject: (number: string) => string;
  overdueBody: (number: string, issuerName: string, dueDate: string) => string;
  paidTitle: (number: string) => string;
  paidPreview: (number: string) => string;
  paidSubject: (number: string) => string;
  paidBody: (number: string, issuerName: string) => string;
  number: string;
  customer: string;
  supplier: string;
  issued: string;
  due: string;
  total: string;
  openInvoice: string;
  footerInvoice: string;
};

type SystemEmailCopy = {
  inviteTitle: (workspaceName: string) => string;
  invitePreview: (inviterName: string, workspaceName: string) => string;
  inviteSubject: (workspaceName: string, expiryNote: string) => string;
  inviteExpiryNote: (label: string) => string;
  inviteBody1: (
    inviterName: string,
    workspaceName: string,
    role: string,
  ) => string;
  inviteBody2: string;
  inviteExpiry: (label: string) => string;
  inviteCtaLead: string;
  inviteAccept: string;
  inviteLinkFallback: string;
  inviteIgnore: string;
  roleAdmin: string;
  roleOwner: string;
  roleMember: string;
  signInTitle: string;
  signInPreview: string;
  signInSubject: string;
  signInHello: (name: string) => string;
  signInTime: string;
  signInIp: string;
  signInBrowser: string;
  unknown: string;
  signInTrustLead: string;
  signInTrust: string;
  securitySettings: string;
  tokenRewardSubject: string;
  tokenRewardTitle: string;
  tokenRewardPreview: string;
  tokenRewardHello: (name: string) => string;
  tokenRewardBody: (tokens: string, workspace: string) => string;
  tokenRewardCta: string;
  footerSystem: string;
};

const INVOICE_CS: InvoiceEmailCopy = {
  sentTitle: (n) => `Faktura ${n}`,
  sentPreview: (n, issuer) => `Faktura ${n} od ${issuer}`,
  sentSubject: (n, issuer) => `Faktura ${n} — ${issuer}`,
  defaultCover:
    "Dobrý den,\n\nv příloze zasílám fakturu {number}.\n\nS pozdravem",
  overdueTitle: (n) => `Připomínka: faktura ${n}`,
  overduePreview: (n) => `Faktura ${n} je po splatnosti`,
  overdueSubject: (n) => `Připomínka: faktura ${n}`,
  overdueBody: (n, issuer, due) =>
    `Dobrý den, dovolujeme si připomenout, že faktura ${n} od ${issuer} je po splatnosti (${due}).`,
  paidTitle: (n) => `Platba přijata — ${n}`,
  paidPreview: (n) => `Platba za fakturu ${n} byla zaznamenána`,
  paidSubject: (n) => `Platba přijata — ${n}`,
  paidBody: (n, issuer) =>
    `Dobrý den, potvrzujeme přijetí platby za fakturu ${n} od ${issuer}.`,
  number: "Číslo",
  customer: "Odběratel",
  supplier: "Dodavatel",
  issued: "Vystaveno",
  due: "Splatnost",
  total: "Celkem",
  openInvoice: "Otevřít fakturu",
  footerInvoice: "Odesláno přes Invoicey.",
};

const INVOICE_EN: InvoiceEmailCopy = {
  sentTitle: (n) => `Invoice ${n}`,
  sentPreview: (n, issuer) => `Invoice ${n} from ${issuer}`,
  sentSubject: (n, issuer) => `Invoice ${n} — ${issuer}`,
  defaultCover:
    "Hello,\n\nplease find invoice {number} attached.\n\nKind regards",
  overdueTitle: (n) => `Reminder: invoice ${n}`,
  overduePreview: (n) => `Invoice ${n} is overdue`,
  overdueSubject: (n) => `Reminder: invoice ${n}`,
  overdueBody: (n, issuer, due) =>
    `Hello, this is a reminder that invoice ${n} from ${issuer} is overdue (${due}).`,
  paidTitle: (n) => `Payment received — ${n}`,
  paidPreview: (n) => `Payment for invoice ${n} has been recorded`,
  paidSubject: (n) => `Payment received — ${n}`,
  paidBody: (n, issuer) =>
    `Hello, we confirm receipt of payment for invoice ${n} from ${issuer}.`,
  number: "Number",
  customer: "Customer",
  supplier: "Supplier",
  issued: "Issued",
  due: "Due",
  total: "Total",
  openInvoice: "Open invoice",
  footerInvoice: "Sent with Invoicey.",
};

const SYSTEM_CS: SystemEmailCopy = {
  inviteTitle: (ws) => `Pozvánka do ${ws}`,
  invitePreview: (inviter, ws) => `${inviter} vás zve do workspace ${ws}`,
  inviteSubject: (ws, note) => `Pozvánka do ${ws}${note}`,
  inviteExpiryNote: (label) => ` (platí do ${label})`,
  inviteBody1: (inviter, ws, role) =>
    `${inviter} vás zve do pracovního prostoru ${ws} v Invoicey jako ${role}.`,
  inviteBody2:
    "Po přijetí uvidíte faktury, klienty a nastavení tohoto pracovního prostoru podle své role. Přihlaste se účtem se stejným e-mailem, na který přišla tato pozvánka.",
  inviteExpiry: (label) =>
    `Pozvánka platí do ${label} (časové pásmo Evropa/Praha).`,
  inviteCtaLead: "Kliknutím na tlačítko pozvánku otevřete:",
  inviteAccept: "Přijmout pozvánku",
  inviteLinkFallback: "Pokud tlačítko nefunguje, otevřete odkaz v prohlížeči:",
  inviteIgnore:
    "Pokud jste tuto pozvánku neočekávali, e-mail můžete ignorovat.",
  roleAdmin: "správce",
  roleOwner: "vlastník",
  roleMember: "člen",
  signInTitle: "Nové přihlášení do Invoicey",
  signInPreview: "Detekovali jsme přihlášení z nového zařízení",
  signInSubject: "Nové přihlášení do Invoicey",
  signInHello: (name) =>
    `Ahoj${name.trim() ? ` ${name.trim()}` : ""}, zaznamenali jsme přihlášení z zařízení, které zatím není důvěryhodné.`,
  signInTime: "Čas",
  signInIp: "IP",
  signInBrowser: "Prohlížeč",
  unknown: "neznámá",
  signInTrustLead:
    "Pokud jste to byli vy, můžete zařízení označit jako důvěryhodné. Pokud ne, odvolejte relace v nastavení zabezpečení.",
  signInTrust: "Důvěřovat tomuto zařízení",
  securitySettings: "Nastavení zabezpečení",
  tokenRewardSubject: "Máte bonusové AI tokeny",
  tokenRewardTitle: "První faktura je na světě",
  tokenRewardPreview: "Za první vystavenou fakturu jsme přidali AI tokeny",
  tokenRewardHello: (name) => `Gratulujeme, ${name}!`,
  tokenRewardBody: (tokens, workspace) =>
    `Vystavili jste první fakturu ve workspace ${workspace}. Přidali jsme vám ${tokens} AI tokenů navíc — použijte je na koncepty faktur, Slack nebo MCP.`,
  tokenRewardCta: "Zobrazit spotřebu",
  footerSystem: "Toto je systémový e-mail od Invoicey.",
};

const SYSTEM_EN: SystemEmailCopy = {
  inviteTitle: (ws) => `Invitation to ${ws}`,
  invitePreview: (inviter, ws) => `${inviter} invited you to ${ws}`,
  inviteSubject: (ws, note) => `Invitation to ${ws}${note}`,
  inviteExpiryNote: (label) => ` (expires ${label})`,
  inviteBody1: (inviter, ws, role) =>
    `${inviter} invited you to the ${ws} workspace on Invoicey as ${role}.`,
  inviteBody2:
    "After you accept, you will see invoices, clients, and settings for this workspace according to your role. Sign in with the same email this invitation was sent to.",
  inviteExpiry: (label) =>
    `This invitation expires on ${label} (Europe/Prague).`,
  inviteCtaLead: "Open the invitation with the button:",
  inviteAccept: "Accept invitation",
  inviteLinkFallback:
    "If the button does not work, open this link in a browser:",
  inviteIgnore:
    "If you were not expecting this invitation, you can ignore this email.",
  roleAdmin: "admin",
  roleOwner: "owner",
  roleMember: "member",
  signInTitle: "New sign-in to Invoicey",
  signInPreview: "We detected a sign-in from a new device",
  signInSubject: "New sign-in to Invoicey",
  signInHello: (name) =>
    `Hi${name.trim() ? ` ${name.trim()}` : ""}, we recorded a sign-in from a device that is not trusted yet.`,
  signInTime: "Time",
  signInIp: "IP",
  signInBrowser: "Browser",
  unknown: "unknown",
  signInTrustLead:
    "If this was you, you can mark the device as trusted. If not, revoke sessions in security settings.",
  signInTrust: "Trust this device",
  securitySettings: "Security settings",
  tokenRewardSubject: "You've earned bonus AI tokens",
  tokenRewardTitle: "Your first invoice is out",
  tokenRewardPreview: "We added AI tokens for issuing your first invoice",
  tokenRewardHello: (name) => `Congratulations, ${name}!`,
  tokenRewardBody: (tokens, workspace) =>
    `You issued your first invoice in ${workspace}. We've added ${tokens} bonus AI tokens — spend them on invoice drafts, Slack, or MCP.`,
  tokenRewardCta: "View usage",
  footerSystem: "This is a system email from Invoicey.",
};

export function invoiceEmailCopy(locale: EmailLocale): InvoiceEmailCopy {
  switch (locale) {
    case "cs":
      return INVOICE_CS;
    case "en":
      return INVOICE_EN;
    default: {
      const _exhaustive: never = locale;
      return _exhaustive;
    }
  }
}

export function systemEmailCopy(locale: EmailLocale): SystemEmailCopy {
  switch (locale) {
    case "cs":
      return SYSTEM_CS;
    case "en":
      return SYSTEM_EN;
    default: {
      const _exhaustive: never = locale;
      return _exhaustive;
    }
  }
}

export function defaultInvoiceSubjectTemplate(locale: EmailLocale): string {
  return locale === "en"
    ? "Invoice {number} — {issuerName}"
    : "Faktura {number} — {issuerName}";
}

export function defaultInvoiceCoverTemplate(locale: EmailLocale): string {
  return invoiceEmailCopy(locale).defaultCover;
}
