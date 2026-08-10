import { ClientSnapshotSchema } from "@invoicey/invoice-core/schema";
import type { z } from "zod";

import type { ClientAddressParts } from "./format-address";

/** Fields required to assemble a persisted client snapshot (caller supplies `id`). */
export interface ClientDraft
	extends Omit<z.infer<typeof ClientSnapshotSchema>, "id"> {}

export type LookupAresResult =
	| { ok: true; draft: ClientDraft }
	| {
			ok: false;
			kind: "not_found" | "invalid_ico" | "invalid_response" | "http_error";
			message: string;
			httpStatus?: number;
	  };

/** One hit from ARES `vyhledat` by obchodní jméno. */
export interface SearchAresMatch {
	ico: string;
	name: string;
	dic: string | null;
	address: ClientAddressParts | null;
	/** Flat label for Slack / UI choice buttons. */
	addressText: string | null;
}

export type SearchAresResult =
	| {
			ok: true;
			query: string;
			total: number;
			matches: SearchAresMatch[];
	  }
	| {
			ok: false;
			kind: "invalid_query" | "invalid_response" | "http_error";
			message: string;
			httpStatus?: number;
	  };
