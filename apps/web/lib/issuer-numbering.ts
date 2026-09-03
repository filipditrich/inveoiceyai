import { eq } from "drizzle-orm";

import { issuerNumberingSchemes } from "@invoicey/db";
import { db } from "@invoicey/db/client";

export const ISSUER_DOC_TYPES = [
  "invoice",
  "proforma",
  "advance",
  "credit_note",
] as const;

export type IssuerDocType = (typeof ISSUER_DOC_TYPES)[number];

export const DEFAULT_NUMBERING_TEMPLATES: Record<IssuerDocType, string> = {
  invoice: "{YYYY}{####}",
  proforma: "PF-{YYYY}-{####}",
  advance: "ZF-{YYYY}-{####}",
  credit_note: "DOB-{YYYY}-{####}",
};

/** Row shape the backfill needs to decide what is missing. */
type ExistingScheme = { issuerId: string; docType: string };

function missingSchemeRows(
  workspaceId: string,
  issuerIds: readonly string[],
  existing: readonly ExistingScheme[],
) {
  const year = new Date().getFullYear();
  const have = new Set(existing.map((s) => `${s.issuerId}:${s.docType}`));
  const rows = [];
  for (const issuerId of issuerIds) {
    for (const docType of ISSUER_DOC_TYPES) {
      if (have.has(`${issuerId}:${docType}`)) {
        continue;
      }
      rows.push({
        id: crypto.randomUUID(),
        workspaceId,
        issuerId,
        docType,
        template: DEFAULT_NUMBERING_TEMPLATES[docType],
        resetPeriod: "yearly",
        counter: 0,
        counterYear: year,
        padding: 4,
      });
    }
  }
  return rows;
}

/**
 * Inserts missing default numbering schemes for an issuer (idempotent).
 * Does not overwrite existing counters/templates.
 *
 * One SELECT plus at most one batched INSERT. This runs on read paths, so the
 * steady state (nothing missing) must not cost a round trip per document type.
 */
export async function ensureIssuerNumberingSchemes(
  database: typeof db,
  opts: { workspaceId: string; issuerId: string },
): Promise<void> {
  const existing = await database
    .select({
      issuerId: issuerNumberingSchemes.issuerId,
      docType: issuerNumberingSchemes.docType,
    })
    .from(issuerNumberingSchemes)
    .where(eq(issuerNumberingSchemes.issuerId, opts.issuerId));

  const rows = missingSchemeRows(opts.workspaceId, [opts.issuerId], existing);
  if (rows.length === 0) {
    return;
  }
  await database
    .insert(issuerNumberingSchemes)
    .values(rows)
    .onConflictDoNothing();
}

/**
 * Backfill defaults for every issuer in the workspace that is missing schemes.
 *
 * Takes the schemes the caller already read so the common path — every issuer
 * already has all four — costs zero extra queries. Returns the rows it wrote so
 * the caller can use them without re-reading.
 */
export async function ensureAllIssuerNumberingSchemes(
  workspaceId: string,
  issuerIds: readonly string[],
  existing: readonly ExistingScheme[],
): Promise<(typeof issuerNumberingSchemes.$inferInsert)[]> {
  const rows = missingSchemeRows(workspaceId, issuerIds, existing);
  if (rows.length === 0) {
    return [];
  }
  await db.insert(issuerNumberingSchemes).values(rows).onConflictDoNothing();
  return rows;
}
