import {
  isInvoiceOriginProvider,
  type InvoiceOriginProvider,
} from "@invoicey/invoice-core/import";

export type MigrationNote =
  | "oauthLater"
  | "apiKeyLater"
  | "clientCredentialsLater"
  | "onPrem"
  | "isdocZipLater";

export type MigrationProvider = {
  id: InvoiceOriginProvider;
  files: "live";
  connect: "locked";
  note?: MigrationNote;
};

/**
 * Czech invoicing tools shown on welcome + import.
 * File dump is live; hosted Connect stays locked (see research note).
 */
export const MIGRATION_PROVIDERS: readonly MigrationProvider[] = [
  { id: "fakturoid", files: "live", connect: "locked", note: "oauthLater" },
  {
    id: "fakturaonline",
    files: "live",
    connect: "locked",
    note: "apiKeyLater",
  },
  {
    id: "idoklad",
    files: "live",
    connect: "locked",
    note: "clientCredentialsLater",
  },
  {
    id: "superfaktura",
    files: "live",
    connect: "locked",
    note: "apiKeyLater",
  },
  {
    id: "vyfakturuj",
    files: "live",
    connect: "locked",
    note: "isdocZipLater",
  },
  { id: "iucto", files: "live", connect: "locked" },
  { id: "pohoda", files: "live", connect: "locked", note: "onPrem" },
  { id: "money_s3", files: "live", connect: "locked", note: "onPrem" },
  { id: "custom", files: "live", connect: "locked" },
];

export function importHrefForOrigin(origin: InvoiceOriginProvider): string {
  return `/invoices/import?origin=${encodeURIComponent(origin)}`;
}

export function originFromQuery(
  value: string | null | undefined,
): InvoiceOriginProvider | null {
  if (!value) {
    return null;
  }
  return isInvoiceOriginProvider(value) ? value : null;
}
