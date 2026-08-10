import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
	AFRelationship,
	PDFArray,
	PDFDict,
	PDFDocument,
	PDFHexString,
	PDFName,
	PDFRawStream,
	PDFString,
	decodePDFRawStream,
} from "pdf-lib";

/** ISDOC 6.0.2 requires this exact embedded filename for ISDOC.PDF. */
export const ISDOC_EMBEDDED_FILENAME = "invoice.isdoc" as const;

export interface EmbedIsdocInPdfOptions {
	title?: string;
	author?: string;
	/** Fixed timestamp for reproducible PDFs; defaults to now. */
	date?: Date;
}

let cachedIcc: Uint8Array | undefined;

function resolveVendoredIccPath(): string {
	const candidates = [
		path.join(
			path.dirname(fileURLToPath(import.meta.url)),
			"../../assets/icc",
			"sRGB-v2-micro.icc",
		),
		path.join(
			process.cwd(),
			"packages/invoice-core/assets/icc",
			"sRGB-v2-micro.icc",
		),
		path.join(
			process.cwd(),
			"../../packages/invoice-core/assets/icc",
			"sRGB-v2-micro.icc",
		),
	];
	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}
	throw new Error(
		`Missing vendored sRGB ICC — tried ${candidates.join(", ")}`,
	);
}

function readSrgbIcc(): Uint8Array {
	if (!cachedIcc) {
		cachedIcc = new Uint8Array(readFileSync(resolveVendoredIccPath()));
	}
	return cachedIcc;
}

function formatPdfDate(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return (
		`${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
		`T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}+00:00`
	);
}

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

function embeddedFilesNameTree(doc: PDFDocument): PDFArray | undefined {
	const names = doc.catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
	if (!names) {
		return undefined;
	}
	const embeddedFiles = names.lookupMaybe(PDFName.of("EmbeddedFiles"), PDFDict);
	if (!embeddedFiles) {
		return undefined;
	}
	return embeddedFiles.lookupMaybe(PDFName.of("Names"), PDFArray);
}

/**
 * PDF/A-3b identification + sRGB OutputIntent.
 * Not PDF/A-3a (no tagged structure tree while on react-pdf).
 */
function applyPdfA3bScaffolding(
	doc: PDFDocument,
	options: { title: string; author: string; date: Date },
): void {
	const { title, author, date } = options;
	doc.setTitle(title);
	doc.setAuthor(author);
	doc.setProducer("Invoicey");
	doc.setCreator("Invoicey");
	doc.setCreationDate(date);
	doc.setModificationDate(date);

	const icc = readSrgbIcc();
	const iccStream = doc.context.stream(icc, {
		Length: icc.length,
		N: 3,
	});
	const iccRef = doc.context.register(iccStream);
	const outputIntent = doc.context.obj({
		Type: "OutputIntent",
		S: "GTS_PDFA1",
		OutputConditionIdentifier: PDFString.of("sRGB"),
		Info: PDFString.of("sRGB IEC61966-2.1"),
		DestOutputProfile: iccRef,
	});
	const outputIntentRef = doc.context.register(outputIntent);
	doc.catalog.set(
		PDFName.of("OutputIntents"),
		doc.context.obj([outputIntentRef]),
	);

	const dateStr = formatPdfDate(date);
	const metadataXml = `
<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Invoicey">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <dc:format>application/pdf</dc:format>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(title)}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${escapeXml(author)}</rdf:li></rdf:Seq></dc:creator>
      <xmp:CreatorTool>Invoicey</xmp:CreatorTool>
      <xmp:CreateDate>${dateStr}</xmp:CreateDate>
      <xmp:ModifyDate>${dateStr}</xmp:ModifyDate>
      <pdf:Producer>Invoicey</pdf:Producer>
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`.trim();

	const metadataStream = doc.context.stream(metadataXml, {
		Type: "Metadata",
		Subtype: "XML",
		Length: metadataXml.length,
	});
	doc.catalog.set(PDFName.of("Metadata"), doc.context.register(metadataStream));
}

/** ISDOC requires EF to list both /F and /UF stream refs. */
function ensureEfHasUf(doc: PDFDocument): void {
	const nameTree = embeddedFilesNameTree(doc);
	if (!nameTree) {
		return;
	}

	for (let i = 1; i < nameTree.size(); i += 2) {
		const fileSpec = nameTree.lookup(i, PDFDict);
		const ef = fileSpec.lookupMaybe(PDFName.of("EF"), PDFDict);
		if (!ef) {
			continue;
		}
		const fRef = ef.get(PDFName.of("F"));
		if (fRef && !ef.has(PDFName.of("UF"))) {
			ef.set(PDFName.of("UF"), fRef);
		}
	}
}

function decodeFileSpecName(value: unknown): string | undefined {
	if (value instanceof PDFHexString || value instanceof PDFString) {
		return value.decodeText();
	}
	return undefined;
}

/**
 * Extract the embedded `invoice.isdoc` XML from an ISDOC.PDF, or `null` if absent.
 */
export async function extractEmbeddedIsdoc(
	pdfBytes: Uint8Array,
): Promise<string | null> {
	const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
	const nameTree = embeddedFilesNameTree(doc);
	if (!nameTree) {
		return null;
	}

	for (let i = 0; i < nameTree.size(); i += 2) {
		const name = decodeFileSpecName(nameTree.lookup(i));
		if (name !== ISDOC_EMBEDDED_FILENAME) {
			continue;
		}
		const fileSpec = nameTree.lookup(i + 1, PDFDict);
		const ef = fileSpec.lookup(PDFName.of("EF"), PDFDict);
		const stream = ef.lookup(PDFName.of("F"));
		if (!(stream instanceof PDFRawStream)) {
			return null;
		}
		const decoded = decodePDFRawStream(stream).decode();
		return new TextDecoder("utf-8").decode(decoded);
	}
	return null;
}

/**
 * Package a visual invoice PDF as ISDOC.PDF: embed `invoice.isdoc` with Catalog `/AF`
 * + EmbeddedFiles, `/AFRelationship` Alternative, and PDF/A-3b scaffolding.
 */
export async function embedIsdocInPdf(
	visualPdfBytes: Uint8Array,
	isdocXml: string,
	options: EmbedIsdocInPdfOptions = {},
): Promise<Uint8Array> {
	const date = options.date ?? new Date();
	const title = options.title ?? "Faktura";
	const author = options.author ?? "Invoicey";

	const doc = await PDFDocument.load(visualPdfBytes, { updateMetadata: false });
	const isdocBytes = new TextEncoder().encode(isdocXml);

	await doc.attach(isdocBytes, ISDOC_EMBEDDED_FILENAME, {
		mimeType: "text/xml",
		description: "ISDOC 6.0.2",
		creationDate: date,
		modificationDate: date,
		afRelationship: AFRelationship.Alternative,
	});

	applyPdfA3bScaffolding(doc, { title, author, date });

	const packed = await doc.save({ useObjectStreams: false });

	/** reload so Filespec objects exist, then add EF /UF required by ISDOC */
	const reloaded = await PDFDocument.load(packed, { updateMetadata: false });
	ensureEfHasUf(reloaded);
	return reloaded.save({ useObjectStreams: false });
}
