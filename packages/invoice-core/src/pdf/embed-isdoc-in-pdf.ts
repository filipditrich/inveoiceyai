import { PDFDocument } from "pdf-lib";

/** ISDOC 6.0.2 recommended embedded name for ISDOC.PDF. */
export const ISDOC_EMBEDDED_FILENAME = "invoice.isdoc" as const;

/** Attach ISDOC XML inside a rendered invoice PDF (pdf-lib EmbeddedFiles). */
export async function embedIsdocInPdf(
	pdfBytes: Uint8Array,
	isdocXml: string,
	isdocFileName: string = ISDOC_EMBEDDED_FILENAME,
): Promise<Uint8Array> {
	const pdfDoc = await PDFDocument.load(pdfBytes);
	const isdocBytes = new TextEncoder().encode(isdocXml);

	await pdfDoc.attach(isdocBytes, isdocFileName, {
		mimeType: "application/xml",
		description: "ISDOC 6.0.2",
		creationDate: new Date(),
		modificationDate: new Date(),
	});

	return pdfDoc.save();
}
