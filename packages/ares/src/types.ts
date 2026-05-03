import { ClientSnapshotSchema } from "@invoicey/invoice-core/schema";
import type { z } from "zod";

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
