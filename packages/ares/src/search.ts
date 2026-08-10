import { IcoSchema } from "@invoicey/invoice-core/schema";
import { z } from "zod";

import { ARES_EKONOMICKE_SUBJEKTY_ORIGIN } from "./client";
import {
	mapSidloToClientAddressParts,
	type ClientAddressParts,
} from "./format-address";
import type { SearchAresResult, SearchAresMatch } from "./types";

const AresSidloSchema = z
	.object({
		kodStatu: z.string().optional(),
		nazevUlice: z.string().optional(),
		nazevObce: z.string().optional(),
		cisloDomovni: z.number().optional(),
		cisloOrientacni: z.number().nullable().optional(),
		cisloOrientacniPismeno: z.string().nullable().optional(),
		psc: z.number().optional(),
		textovaAdresa: z.string().optional(),
	})
	.passthrough();

const AresSearchSubjectSchema = z
	.object({
		ico: z.string(),
		obchodniJmeno: z.string().optional(),
		sidlo: AresSidloSchema.optional(),
		dic: z.string().nullable().optional(),
	})
	.passthrough();

const AresSearchBodySchema = z
	.object({
		pocetCelkem: z.number().optional(),
		ekonomickeSubjekty: z.array(AresSearchSubjectSchema).optional(),
	})
	.passthrough();

function defaultFetchSignal(): AbortSignal | undefined {
	if (
		typeof AbortSignal !== "undefined" &&
		typeof AbortSignal.timeout === "function"
	) {
		return AbortSignal.timeout(12000);
	}
	return undefined;
}

function trimmedString(value?: string | null): string | undefined {
	const t = typeof value === "string" ? value.trim() : undefined;
	return (t?.length ?? 0) > 0 ? t : undefined;
}

function formatAddressText(address: ClientAddressParts): string {
	return `${address.street}, ${address.city}, ${address.zip}`;
}

function toMatch(
	row: z.infer<typeof AresSearchSubjectSchema>,
): SearchAresMatch | null {
	let ico: string;
	try {
		ico = IcoSchema.parse(String(row.ico).trim());
	} catch {
		return null;
	}
	const name = trimmedString(row.obchodniJmeno);
	if (!name) return null;

	const address = row.sidlo ? mapSidloToClientAddressParts(row.sidlo) : null;
	const addressText =
		address !== null
			? formatAddressText(address)
			: trimmedString(row.sidlo?.textovaAdresa) ?? null;

	const dic = trimmedString(row.dic ?? undefined) ?? null;

	return {
		ico,
		name,
		dic,
		address,
		addressText,
	};
}

/**
 * Search Czech economic subjects by obchodní jméno via ARES REST `vyhledat`.
 * Returns lightweight matches; callers should `lookup` by IČO for a full draft
 * when address mapping is incomplete, or when disambiguating.
 */
export async function searchAresByObchodniJmeno(
	queryRaw: string,
	options?: { limit?: number; signal?: AbortSignal },
): Promise<SearchAresResult> {
	const query = queryRaw.trim();
	if (query.length < 2) {
		return {
			ok: false,
			kind: "invalid_query",
			message: "Search query must be at least 2 characters.",
		};
	}

	const limit = Math.min(Math.max(options?.limit ?? 5, 1), 20);
	const signal = options?.signal ?? defaultFetchSignal();

	let response: Response;
	try {
		response = await fetch(
			`${ARES_EKONOMICKE_SUBJEKTY_ORIGIN}/ekonomicke-subjekty/vyhledat`,
			{
				method: "POST",
				signal,
				headers: {
					accept: "application/json",
					"content-type": "application/json",
				},
				body: JSON.stringify({ obchodniJmeno: query, pocet: limit }),
				cache: "no-store",
			},
		);
	} catch (cause) {
		const message =
			cause instanceof Error ? cause.message : "ARES search failed.";
		return { ok: false, kind: "http_error", message, httpStatus: 0 };
	}

	if (!response.ok) {
		return {
			ok: false,
			kind: "http_error",
			message: `ARES search returned HTTP ${response.status}.`,
			httpStatus: response.status,
		};
	}

	let body: unknown;
	try {
		body = await response.json();
	} catch {
		return {
			ok: false,
			kind: "invalid_response",
			message: "ARES search returned invalid JSON.",
			httpStatus: response.status,
		};
	}

	const parsed = AresSearchBodySchema.safeParse(body);
	if (!parsed.success) {
		return {
			ok: false,
			kind: "invalid_response",
			message: "ARES search body did not match expected shape.",
			httpStatus: response.status,
		};
	}

	const rows = parsed.data.ekonomickeSubjekty ?? [];
	const matches: SearchAresMatch[] = [];
	const seen = new Set<string>();
	for (const row of rows) {
		const match = toMatch(row);
		if (!match || seen.has(match.ico)) continue;
		seen.add(match.ico);
		matches.push(match);
	}

	return {
		ok: true,
		query,
		total: parsed.data.pocetCelkem ?? matches.length,
		matches,
	};
}
