import { extractIsdocFromPdf } from "@invoicey/invoice-core";

export type DocumentKind = "pdf" | "isdoc" | "isdocx" | "image" | "other";
export type DocumentClassification =
  | "invoice"
  | "credit_note"
  | "proforma"
  | "reminder"
  | "statement"
  | "contract"
  | "receipt"
  | "other"
  | "spam"
  | "unknown";

const FORWARD_FROM_RE = /(?:^|\n)From:\s*(.+@.+\.[a-z]{2,})/imu;

export function parseForwardedFrom(
  body: string | null | undefined,
): string | null {
  if (!body) return null;
  const match = FORWARD_FROM_RE.exec(body);
  return match?.[1]?.trim() ?? null;
}

const PROFORMA_RE = /proforma|zálohov|zalohov|advance/iu;
const REMINDER_RE = /upomín|upomin|reminder|penalty|penále|penale/iu;
const STATEMENT_RE = /výpis|vypis|statement|kontoauszug/iu;

export function kindFromFile(fileName: string, mimeType: string): DocumentKind {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".isdocx") || mimeType === "application/zip")
    return "isdocx";
  if (lower.endsWith(".isdoc") || mimeType.includes("xml")) return "isdoc";
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  return "other";
}

export function classifyByName(
  fileName: string,
  subject?: string | null,
): DocumentClassification | null {
  const haystack = `${fileName} ${subject ?? ""}`;
  if (PROFORMA_RE.test(haystack)) return "proforma";
  if (REMINDER_RE.test(haystack)) return "reminder";
  if (STATEMENT_RE.test(haystack)) return "statement";
  return null;
}

export async function classifyDocument(input: {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  subject?: string | null;
}): Promise<{
  kind: DocumentKind;
  classification: DocumentClassification;
  source: "deterministic" | "manual";
  isdocXml?: string;
}> {
  const kind = kindFromFile(input.fileName, input.mimeType);
  const named = classifyByName(input.fileName, input.subject);

  if (kind === "isdoc" || kind === "isdocx") {
    const xml = new TextDecoder().decode(input.bytes);
    const credit = /<DocumentType>\s*2\s*</u.test(xml);
    return {
      kind,
      classification: credit ? "credit_note" : "invoice",
      source: "deterministic",
      isdocXml: xml,
    };
  }

  if (kind === "pdf") {
    const xml = await extractIsdocFromPdf(input.bytes);
    if (xml) {
      const credit = /<DocumentType>\s*2\s*</u.test(xml);
      return {
        kind,
        classification: credit ? "credit_note" : "invoice",
        source: "deterministic",
        isdocXml: xml,
      };
    }
  }

  if (named) {
    return { kind, classification: named, source: "deterministic" };
  }

  return { kind, classification: "unknown", source: "deterministic" };
}
