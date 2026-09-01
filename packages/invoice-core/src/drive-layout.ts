import { invoiceArtifactFilenameStem } from "./artifact-filenames";
import type { DocType } from "./numbering";
import type { InvoiceLanguage } from "./schema";

export const DEFAULT_DRIVE_LAYOUT_TEMPLATE = "{year}/{kind}_{number}";
export const DRIVE_LAYOUT_MAX_LENGTH = 200;

const KNOWN_TOKENS = [
  "year",
  "month",
  "kind",
  "number",
  "client",
  "name",
] as const;

export type DriveLayoutToken = (typeof KNOWN_TOKENS)[number];

export type DriveLayoutParseError =
  | "empty"
  | "too_long"
  | "invalid_chars"
  | "unknown_token"
  | "missing_number"
  | "dotdot";

export type DriveLayoutParseResult =
  | { ok: true; template: string }
  | { ok: false; error: DriveLayoutParseError };

export interface DriveLayoutInput {
  template?: string | null;
  issueDate: string;
  number: string;
  language?: InvoiceLanguage | null;
  docType?: DocType | string | null;
  clientName?: string | null;
}

/**
 * Folder or file segment for Finder. Keeps letters and spaces; strips path
 * punctuation that would escape the tree.
 */
export function sanitizeDriveSegment(input: string): string {
  const folded = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[/\\:]+/g, " ")
    .replace(/\.\./g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  const strippedDots = folded.replace(/^\.+|\.+$/g, "").trim();
  return strippedDots.length > 0 ? strippedDots : "invoice";
}

export function parseDriveLayoutTemplate(
  raw: string | null | undefined,
): DriveLayoutParseResult {
  const template = raw?.trim() ?? "";
  if (template.length === 0) {
    return { ok: false, error: "empty" };
  }
  if (template.length > DRIVE_LAYOUT_MAX_LENGTH) {
    return { ok: false, error: "too_long" };
  }
  if (template.includes("..")) {
    return { ok: false, error: "dotdot" };
  }
  const tokenMatches = [...template.matchAll(/\{([^}]*)\}/g)];
  const tokens: string[] = [];
  for (const match of tokenMatches) {
    const token = match[1] ?? "";
    if (!KNOWN_TOKENS.includes(token as DriveLayoutToken)) {
      return { ok: false, error: "unknown_token" };
    }
    tokens.push(token);
  }
  const withoutTokens = template.replace(/\{[a-z]+\}/g, "");
  if (/[^A-Za-z0-9._/-]/.test(withoutTokens)) {
    return { ok: false, error: "invalid_chars" };
  }
  if (!tokens.includes("number") && !tokens.includes("name")) {
    return { ok: false, error: "missing_number" };
  }
  return { ok: true, template };
}

export function resolveDriveLayoutTemplate(
  raw: string | null | undefined,
): string {
  const parsed = parseDriveLayoutTemplate(raw);
  return parsed.ok ? parsed.template : DEFAULT_DRIVE_LAYOUT_TEMPLATE;
}

function yearMonthFromIssueDate(issueDate: string): {
  year: string;
  month: string;
} {
  const match = /^(\d{4})-(\d{2})/.exec(issueDate.trim());
  if (!match) {
    return { year: "0000", month: "00" };
  }
  return { year: match[1], month: match[2] };
}

export interface DriveLayoutPath {
  /** Posix path under the issuer folder, no leading slash, no extension. */
  relPath: string;
  stem: string;
  pdf: string;
  isdoc: string;
}

/**
 * Apply a Drive layout under one issuer. Workspace/issuer folders are added
 * by the index builder using live names + ids.
 */
export function applyDriveLayout(input: DriveLayoutInput): DriveLayoutPath {
  const template = resolveDriveLayoutTemplate(input.template);
  const { year, month } = yearMonthFromIssueDate(input.issueDate);
  const kind = invoiceArtifactFilenameStem({
    number: "x",
    language: input.language,
    docType: input.docType,
    template: "{kind}",
  });
  const number = sanitizeDriveSegment(input.number.trim() || "invoice");
  const name = invoiceArtifactFilenameStem({
    number: input.number,
    language: input.language,
    docType: input.docType,
    template: "{kind}_{number}",
  });
  const client = sanitizeDriveSegment(input.clientName?.trim() || "client");
  const applied = template
    .replaceAll("{year}", year)
    .replaceAll("{month}", month)
    .replaceAll("{kind}", kind)
    .replaceAll("{number}", number)
    .replaceAll("{client}", client)
    .replaceAll("{name}", name);
  const segments = applied
    .split("/")
    .map((segment) => sanitizeDriveSegment(segment));
  const relPath = segments.join("/");
  const stem = segments[segments.length - 1] ?? "invoice";
  return {
    relPath,
    stem,
    pdf: `${relPath}.pdf`,
    isdoc: `${relPath}.isdoc`,
  };
}

export interface DriveFolderTitle {
  id: string;
  name: string;
}

/** Suffix live titles that clash under the same parent. Identity stays `id`. */
export function disambiguateDriveTitles(
  folders: DriveFolderTitle[],
): Map<string, string> {
  const counts = new Map<string, number>();
  for (const folder of folders) {
    const key = folder.name.toLocaleLowerCase("cs");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const titles = new Map<string, string>();
  for (const folder of folders) {
    const key = folder.name.toLocaleLowerCase("cs");
    const total = counts.get(key) ?? 1;
    if (total === 1) {
      titles.set(folder.id, folder.name);
      continue;
    }
    const next = (seen.get(key) ?? 0) + 1;
    seen.set(key, next);
    titles.set(folder.id, `${folder.name} (${next})`);
  }
  return titles;
}
