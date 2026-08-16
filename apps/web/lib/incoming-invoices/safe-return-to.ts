/** Keep post-action redirects on the incoming-invoice surfaces. */
export function safeIncomingReturnTo(
  value: FormDataEntryValue | null,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/incoming-invoices")) return null;
  if (trimmed.includes("//") || trimmed.includes("\\")) return null;
  return trimmed;
}

export function incomingActionPath(input: {
  returnTo: string | null;
  fallback: string;
  toast?: string;
  invalid?: string;
}): string {
  const base = input.returnTo ?? input.fallback;
  const url = new URL(base, "https://invoicey.local");
  if (input.invalid) {
    url.searchParams.set("invalid", input.invalid);
  } else if (input.toast) {
    url.searchParams.set("toast", input.toast);
  }
  return `${url.pathname}${url.search}`;
}
