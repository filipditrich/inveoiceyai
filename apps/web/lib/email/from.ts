const DEFAULT_FROM_ADDRESS = "invoices@mail.invoicey.ditrich.me";
const DEFAULT_FROM_NAME = "Invoicey";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ParsedEmailFrom = {
  display: string;
  address: string;
  header: string;
};

export function parseEmailFrom(
  raw: string | undefined | null,
): ParsedEmailFrom {
  const fallback: ParsedEmailFrom = {
    display: DEFAULT_FROM_NAME,
    address: DEFAULT_FROM_ADDRESS,
    header: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_ADDRESS}>`,
  };
  if (!raw || raw.trim() === "") return fallback;

  const trimmed = raw.trim();
  const match = trimmed.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    const display = match[1]?.trim() || DEFAULT_FROM_NAME;
    const address = match[2]?.trim().toLowerCase() || DEFAULT_FROM_ADDRESS;
    if (!EMAIL_RE.test(address)) return fallback;
    return { display, address, header: `${display} <${address}>` };
  }

  if (EMAIL_RE.test(trimmed)) {
    return {
      display: DEFAULT_FROM_NAME,
      address: trimmed.toLowerCase(),
      header: `${DEFAULT_FROM_NAME} <${trimmed.toLowerCase()}>`,
    };
  }

  return fallback;
}

/** `"Name via Invoicey"` display — does not change the From address. */
export function buildViaInvoiceyDisplayName(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, " ");
  if (cleaned.length === 0) return DEFAULT_FROM_NAME;
  if (/via Invoicey$/i.test(cleaned)) return cleaned;
  return `${cleaned} via Invoicey`;
}

export function formatFromHeader(display: string, address: string): string {
  return `${display} <${address}>`;
}

export function isValidEmailAddress(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function applyDisplayNameTemplate(
  template: string | undefined,
  vars: Record<string, string>,
): string {
  const base =
    template?.trim() ||
    (vars.issuerName ? "{issuerName} via Invoicey" : "Invoicey");
  return base.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}
