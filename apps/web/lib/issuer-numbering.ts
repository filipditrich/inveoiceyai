import { issuerNumberingSchemes } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, eq } from "drizzle-orm";

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

/**
 * Inserts missing default numbering schemes for an issuer (idempotent).
 * Does not overwrite existing counters/templates.
 */
export async function ensureIssuerNumberingSchemes(
	database: typeof db,
	opts: { workspaceId: string; issuerId: string },
): Promise<void> {
	const year = new Date().getFullYear();
	for (const docType of ISSUER_DOC_TYPES) {
		const existing = await database
			.select({ id: issuerNumberingSchemes.id })
			.from(issuerNumberingSchemes)
			.where(
				and(
					eq(issuerNumberingSchemes.issuerId, opts.issuerId),
					eq(issuerNumberingSchemes.docType, docType),
				),
			)
			.limit(1);
		if (existing[0]) {
			continue;
		}
		await database.insert(issuerNumberingSchemes).values({
			id: crypto.randomUUID(),
			workspaceId: opts.workspaceId,
			issuerId: opts.issuerId,
			docType,
			template: DEFAULT_NUMBERING_TEMPLATES[docType],
			resetPeriod: "yearly",
			counter: 0,
			counterYear: year,
			padding: 4,
		});
	}
}

/** Backfill defaults for every issuer in the workspace that is missing schemes. */
export async function ensureAllIssuerNumberingSchemes(
	workspaceId: string,
	issuerIds: string[],
): Promise<void> {
	for (const issuerId of issuerIds) {
		await ensureIssuerNumberingSchemes(db, { workspaceId, issuerId });
	}
}
