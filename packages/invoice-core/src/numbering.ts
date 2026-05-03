import type { z } from "zod";
import { InvoiceMetaSchema } from "./schema";

export type DocType = z.infer<typeof InvoiceMetaSchema>["docType"];

export interface NumberingSchemeInput {
	template: string;
	counter: number;
	counterYear?: number;
	resetPeriod: "yearly" | "never";
	padding: number;
	docType: DocType;
	issuerName: string;
}

function docTypeAbbr(docType: DocType): string {
	switch (docType) {
		case "invoice":
			return "FV";
		case "proforma":
			return "PF";
		case "advance":
			return "ZF";
		case "credit_note":
			return "DOB";
	}
}

/** Slug for `{ISSUER}` token: first word, lower alphanumeric, max 12 chars (matches common “NFCtron s.r.o.” → `nfctron`). */
export function slugifyIssuerName(name: string): string {
	const firstWord = name.split(/\s+/)[0] ?? name;
	return firstWord
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "")
		.slice(0, 12);
}

/**
 * Returns the next invoice number for an issue date. Pure: does not persist counter.
 * Caller increments `counter` / updates `counterYear` in the same transaction as insert.
 */
export function nextInvoiceNumber(
	scheme: NumberingSchemeInput,
	issueDate: Date,
): string {
	const year = issueDate.getFullYear();
	const month = String(issueDate.getMonth() + 1).padStart(2, "0");
	const day = String(issueDate.getDate()).padStart(2, "0");

	let next = scheme.counter + 1;
	if (scheme.resetPeriod === "yearly") {
		if (scheme.counterYear !== undefined && scheme.counterYear !== year) {
			next = 1;
		}
	}

	const tokens: Record<string, string> = {
		"{YYYY}": String(year),
		"{YY}": String(year).slice(-2),
		"{MM}": month,
		"{DD}": day,
		"{ISSUER}": slugifyIssuerName(scheme.issuerName),
		"{TYPE}": docTypeAbbr(scheme.docType),
	};

	let result = scheme.template;
	for (const [key, value] of Object.entries(tokens)) {
		result = result.split(key).join(value);
	}

	result = result.replace(/\{(#+)\}/g, (_match, hashes: string) =>
		String(next).padStart(hashes.length, "0"),
	);

	return result;
}
