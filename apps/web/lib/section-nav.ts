/** Landing pages that belong to an invoices or payments sidebar group. */

export type SectionId = "invoices" | "payments";

export type SectionPageId =
  | "invoicesHome"
  | "invoicesRecurring"
  | "invoicesImport"
  | "invoicesFromJson"
  | "paymentsHome"
  | "paymentsRequests"
  | "paymentsConnections";

export type SectionCopyKey =
  | "invoices.home.title"
  | "invoices.home.description"
  | "invoices.recurring.title"
  | "invoices.recurring.description"
  | "invoices.import.title"
  | "invoices.import.description"
  | "invoices.fromJson.title"
  | "invoices.fromJson.description"
  | "payments.home.title"
  | "payments.home.description"
  | "payments.requests.title"
  | "payments.requests.description"
  | "payments.connections.title"
  | "payments.connections.description";

export type SectionPage = {
  id: SectionPageId;
  href: string;
  titleKey: SectionCopyKey;
  descriptionKey: SectionCopyKey;
};

export const INVOICE_SECTION: readonly SectionPage[] = [
  {
    id: "invoicesHome",
    href: "/invoices",
    titleKey: "invoices.home.title",
    descriptionKey: "invoices.home.description",
  },
  {
    id: "invoicesRecurring",
    href: "/invoices/recurring",
    titleKey: "invoices.recurring.title",
    descriptionKey: "invoices.recurring.description",
  },
  {
    id: "invoicesImport",
    href: "/invoices/import",
    titleKey: "invoices.import.title",
    descriptionKey: "invoices.import.description",
  },
  {
    id: "invoicesFromJson",
    href: "/invoices/from-json",
    titleKey: "invoices.fromJson.title",
    descriptionKey: "invoices.fromJson.description",
  },
];

export const PAYMENT_SECTION: readonly SectionPage[] = [
  {
    id: "paymentsHome",
    href: "/payments",
    titleKey: "payments.home.title",
    descriptionKey: "payments.home.description",
  },
  {
    id: "paymentsRequests",
    href: "/payments/requests",
    titleKey: "payments.requests.title",
    descriptionKey: "payments.requests.description",
  },
  {
    id: "paymentsConnections",
    href: "/payments/connections",
    titleKey: "payments.connections.title",
    descriptionKey: "payments.connections.description",
  },
];

function startsWithPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Invoice list and invoice detail — not create, import, recurring, JSON, or render. */
export function isInvoiceListPath(pathname: string): boolean {
  if (pathname === "/invoices") return true;
  if (!pathname.startsWith("/invoices/")) return false;
  if (startsWithPath(pathname, "/invoices/recurring")) return false;
  if (startsWithPath(pathname, "/invoices/import")) return false;
  if (startsWithPath(pathname, "/invoices/from-json")) return false;
  if (startsWithPath(pathname, "/invoices/render")) return false;
  if (startsWithPath(pathname, "/invoices/new")) return false;
  if (startsWithPath(pathname, "/invoices/ai")) return false;
  return true;
}

export function isInvoicesGroupPath(pathname: string): boolean {
  return (
    isInvoiceListPath(pathname) ||
    startsWithPath(pathname, "/invoices/recurring") ||
    startsWithPath(pathname, "/invoices/import") ||
    startsWithPath(pathname, "/invoices/from-json") ||
    startsWithPath(pathname, "/invoices/render")
  );
}

export function isPaymentsGroupPath(pathname: string): boolean {
  return startsWithPath(pathname, "/payments");
}

/** Exact landing page in the group, or null on create/detail flows. */
export function findSectionLanding(
  group: SectionId,
  pathname: string,
): { pages: readonly SectionPage[]; index: number } | null {
  const pages = group === "invoices" ? INVOICE_SECTION : PAYMENT_SECTION;
  const index = pages.findIndex((page) => pathname === page.href);
  if (index < 0) return null;
  return { pages, index };
}

/** Other landings in the group. Null on create/detail; never just prev/next. */
export function sectionSiblingPages(
  group: SectionId,
  pathname: string,
): readonly SectionPage[] | null {
  const landing = findSectionLanding(group, pathname);
  if (!landing) return null;
  return landing.pages.filter((_, index) => index !== landing.index);
}
