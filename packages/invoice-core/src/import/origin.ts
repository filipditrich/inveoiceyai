import { z } from "zod";

/**
 * Known Czech / Invoicey issuers for imported invoice provenance.
 *
 * A plain tuple, with the Zod enum derived from it, so the list and the
 * membership test can be used from a client component without pulling Zod
 * into the browser bundle.
 */
export const INVOICE_ORIGIN_PROVIDERS = [
  "invoicey",
  "fakturaonline",
  "idoklad",
  "fakturoid",
  "pohoda",
  "money_s3",
  "vyfakturuj",
  "superfaktura",
  "custom",
] as const;

export type InvoiceOriginProvider = (typeof INVOICE_ORIGIN_PROVIDERS)[number];

/**
 * Membership test for a provenance string read back from the database or a
 * query parameter, where the value is a free-form string until checked.
 */
export function isInvoiceOriginProvider(
  value: string,
): value is InvoiceOriginProvider {
  // SAFETY: widening the literal tuple to `readonly string[]` only relaxes the
  // argument type of `includes`; the narrowing is what the check establishes.
  return (INVOICE_ORIGIN_PROVIDERS as readonly string[]).includes(value);
}

export const InvoiceOriginProviderSchema = z.enum(INVOICE_ORIGIN_PROVIDERS);

export const IMPORT_COMPLETENESS = ["full", "archive"] as const;
export type ImportCompleteness = (typeof IMPORT_COMPLETENESS)[number];

export const InvoiceOriginSchema = z.object({
  provider: InvoiceOriginProviderSchema,
  label: z.string().trim().max(120).optional(),
  version: z.string().trim().max(64).optional(),
});

export type InvoiceOrigin = z.infer<typeof InvoiceOriginSchema>;

export const ORIGIN_PROVIDER_LABELS: Record<InvoiceOriginProvider, string> = {
  invoicey: "Invoicey",
  fakturaonline: "FakturaOnline.cz",
  idoklad: "iDoklad",
  fakturoid: "Fakturoid",
  pohoda: "Pohoda",
  money_s3: "Money S3",
  vyfakturuj: "VyFakturuj.cz",
  superfaktura: "SuperFaktura",
  custom: "Jiné / vlastní",
};

/**
 * Heuristic origin from ISDOC/PDF producer strings.
 */
export function detectInvoiceOrigin(hints: {
  softwareName?: string | null;
  producer?: string | null;
  creator?: string | null;
  keywords?: string | null;
}): InvoiceOrigin {
  const blob = [
    hints.softwareName,
    hints.producer,
    hints.creator,
    hints.keywords,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!blob.trim()) {
    return { provider: "custom" };
  }

  if (blob.includes("invoicey")) {
    const versionMatch = /\binvoicey[@\s]*v?(\d+\.\d+(?:\.\d+)?)/iu.exec(blob);
    return {
      provider: "invoicey",
      version: versionMatch?.[1],
    };
  }
  if (blob.includes("fakturaonline") || blob.includes("faktura online")) {
    return { provider: "fakturaonline" };
  }
  if (blob.includes("idoklad")) {
    return { provider: "idoklad" };
  }
  if (blob.includes("fakturoid")) {
    return { provider: "fakturoid" };
  }
  if (blob.includes("pohoda")) {
    return { provider: "pohoda" };
  }
  if (
    blob.includes("money s3") ||
    blob.includes("moneys3") ||
    blob.includes("money_s3")
  ) {
    return { provider: "money_s3" };
  }
  if (blob.includes("vyfakturuj")) {
    return { provider: "vyfakturuj" };
  }
  if (blob.includes("superfaktura")) {
    return { provider: "superfaktura" };
  }

  return {
    provider: "custom",
    label: hints.softwareName?.trim() || hints.producer?.trim() || undefined,
  };
}

/** Idempotency key for imported invoices. */
export function buildExternalKey(parts: {
  isdocUuid?: string | null;
  provider: string;
  number: string;
  issueDate: string;
}): string {
  if (parts.isdocUuid?.trim()) {
    return `isdoc:${parts.isdocUuid.trim().toLowerCase()}`;
  }
  return `num:${parts.provider}:${parts.number}:${parts.issueDate}`;
}
