import type { EmailTemplateId } from "@invoicey/emails";

const DEFAULT_INVOICE_FROM = "Invoicey <invoices@invoicey.app>";
const DEFAULT_SYSTEM_FROM = "Invoicey <noreply@invoicey.app>";
const DEFAULT_INVOICE_ADDRESS = "invoices@invoicey.app";
const DEFAULT_SYSTEM_ADDRESS = "noreply@invoicey.app";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SYSTEM_TEMPLATES = new Set<EmailTemplateId>([
  "bank_payment_auto_matched",
  "new_sign_in",
  "workspace_invite",
]);

export type EmailFromFamily = "invoice" | "system";

export type ResolvedEmailFrom = {
  family: EmailFromFamily;
  display: string;
  address: string;
  header: string;
};

export function isValidEmailAddress(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function buildViaDisplay(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, " ");
  if (!cleaned) return "Invoicey";
  if (/via Invoicey$/i.test(cleaned)) return cleaned;
  return `${cleaned} via Invoicey`;
}

function parseFrom(
  raw: string | undefined | null,
  fallbackAddress: string,
): { display: string; address: string } {
  const fallback = {
    display: "Invoicey",
    address: fallbackAddress,
  };
  if (!raw?.trim()) return fallback;
  const match = raw.trim().match(/^(.*?)\s*<([^>]+)>$/);
  if (match?.[2] && EMAIL_RE.test(match[2].trim())) {
    return {
      display: match[1]?.trim() || "Invoicey",
      address: match[2].trim().toLowerCase(),
    };
  }
  if (EMAIL_RE.test(raw.trim())) {
    return { display: "Invoicey", address: raw.trim().toLowerCase() };
  }
  return fallback;
}

export function emailFromFamily(template: EmailTemplateId): EmailFromFamily {
  return SYSTEM_TEMPLATES.has(template) ? "system" : "invoice";
}

export function resolveTransactionalFrom(input: {
  template: EmailTemplateId;
  displayName: string;
  emailFrom?: string | null;
  emailSystemFrom?: string | null;
}): ResolvedEmailFrom {
  const family = emailFromFamily(input.template);
  if (family === "system") {
    const parts = parseFrom(
      input.emailSystemFrom ?? DEFAULT_SYSTEM_FROM,
      DEFAULT_SYSTEM_ADDRESS,
    );
    const display =
      input.displayName.trim().replace(/\s+/g, " ") || parts.display;
    return {
      family,
      display,
      address: parts.address,
      header: `${display} <${parts.address}>`,
    };
  }

  const parts = parseFrom(
    input.emailFrom ?? DEFAULT_INVOICE_FROM,
    DEFAULT_INVOICE_ADDRESS,
  );
  const display = buildViaDisplay(input.displayName);
  return {
    family,
    display,
    address: parts.address,
    header: `${display} <${parts.address}>`,
  };
}
