import { validateXML } from "xmllint-wasm";

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Vendored `isdoc-invoice-6.0.2.xsd`. */
export const ISDOC_INVOICE_XSD_PATH = path.join(
	__dirname,
	"..",
	"..",
	"assets",
	"schemas",
	"isdoc-invoice-6.0.2.xsd",
);

let cachedSchema: string | undefined;

/** Reads the vendored XSD synchronously once (cheap for Vitest bundles). */
export function readCachedIsdocXsd(): string {
	if (!cachedSchema) {
		cachedSchema = readFileSync(ISDOC_INVOICE_XSD_PATH, "utf8");
	}
	return cachedSchema;
}

export interface ValidateIsdocResult {
	readonly ok: boolean;
	readonly errors?: readonly string[];
}

/** Validates serialized ISDOC invoice XML via `xmllint-wasm`. */
export async function validateIsdocXml(xml: string): Promise<ValidateIsdocResult> {
	const schemaContents = readCachedIsdocXsd();
	const res = await validateXML({
		xml: [{ contents: xml, fileName: "invoice.isdoc.xml" }],
		schema: [schemaContents],
		maxMemoryPages: 512,
	});

	return res.valid
		? { ok: true }
		: { ok: false, errors: res.errors.map((e) => e.message) };
}
