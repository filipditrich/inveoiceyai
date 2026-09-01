import type { DocType } from "./numbering";
import type { InvoiceLanguage } from "./schema";

export const DEFAULT_ARTIFACT_FILENAME_TEMPLATE = "{kind}_{number}";

const FILE_KIND: Record<InvoiceLanguage, Record<DocType, string>> = {
  cs: {
    invoice: "faktura",
    credit_note: "dobropis",
    proforma: "proforma",
    advance: "zalohova",
  },
  en: {
    invoice: "invoice",
    credit_note: "credit-note",
    proforma: "proforma",
    advance: "advance",
  },
};

const DOC_TYPES = new Set<DocType>([
  "invoice",
  "proforma",
  "advance",
  "credit_note",
]);

export interface InvoiceArtifactFilenameInput {
  number: string;
  language?: InvoiceLanguage | null;
  docType?: DocType | string | null;
  template?: string | null;
}

function resolveDocType(
  docType: InvoiceArtifactFilenameInput["docType"],
): DocType {
  if (typeof docType === "string" && DOC_TYPES.has(docType as DocType)) {
    return docType as DocType;
  }
  return "invoice";
}

function resolveLanguage(
  language: InvoiceArtifactFilenameInput["language"],
): InvoiceLanguage {
  return language === "en" ? "en" : "cs";
}

function toSafeFileStem(input: string): string {
  const stem = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 120);
  return stem.length > 0 ? stem : "invoice";
}

function stripKnownExtension(template: string): string {
  return template.replace(/\.(pdf|isdoc)$/i, "");
}

/**
 * Localized filename stem for invoice PDF / ISDOC downloads.
 * Default `{kind}_{number}` (cs invoice → `faktura_2026001`).
 */
export function invoiceArtifactFilenameStem(
  input: InvoiceArtifactFilenameInput,
): string {
  const language = resolveLanguage(input.language);
  const docType = resolveDocType(input.docType);
  const kind = FILE_KIND[language][docType];
  const number = toSafeFileStem(input.number.trim() || "invoice");
  const rawTemplate =
    input.template?.trim() || DEFAULT_ARTIFACT_FILENAME_TEMPLATE;
  const applied = stripKnownExtension(rawTemplate)
    .replaceAll("{kind}", kind)
    .replaceAll("{number}", number);
  return toSafeFileStem(applied);
}

export function invoiceArtifactFileNames(input: InvoiceArtifactFilenameInput): {
  pdf: string;
  isdoc: string;
} {
  const stem = invoiceArtifactFilenameStem(input);
  return {
    pdf: `${stem}.pdf`,
    isdoc: `${stem}.isdoc`,
  };
}

export function invoiceArtifactFileNamesFromInvoice(
  invoice: {
    meta: {
      number: string;
      language: InvoiceLanguage;
      docType: DocType;
    };
  },
  template?: string | null,
): { pdf: string; isdoc: string } {
  return invoiceArtifactFileNames({
    number: invoice.meta.number,
    language: invoice.meta.language,
    docType: invoice.meta.docType,
    template,
  });
}
