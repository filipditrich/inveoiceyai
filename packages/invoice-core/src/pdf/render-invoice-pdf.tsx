/** @jsxImportSource react */
import { pdf } from "@react-pdf/renderer";

import type { Invoice } from "../schema";
import { renderSpaydQr } from "../spayd/render-spayd-qr";

import type { InvoicePdfAssets } from "./InvoicePdfDocument";
import { InvoicePdfDocument } from "./InvoicePdfDocument";
import { loadImageForPdf } from "./load-image";
import { registerInvoiceFonts } from "./register-fonts";

async function streamToUint8Array(
	stream: NodeJS.ReadableStream,
): Promise<Uint8Array> {
	const parts: Buffer[] = [];
	await new Promise<void>((resolve, reject) => {
		stream.on("data", (c: Buffer | string | Uint8Array) => {
			parts.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
		});
		stream.on("end", () => resolve());
		stream.on("error", reject);
	});
	return Uint8Array.from(Buffer.concat(parts));
}

export async function renderInvoicePdf(invoice: Invoice): Promise<Uint8Array> {
	registerInvoiceFonts();

	const qrDataUrl = await renderSpaydQr(invoice);
	const logo = await loadImageForPdf(invoice.issuer.logoUrl).catch(() => undefined);
	const stamp =
		customizationAllows(invoice.customization?.showStamp, invoice.issuer.stampUrl)
			? await loadImageForPdf(invoice.issuer.stampUrl).catch(() => undefined)
			: undefined;
	const signature =
		customizationAllows(
			invoice.customization?.showSignature,
			invoice.issuer.signatureUrl,
		)
			? await loadImageForPdf(invoice.issuer.signatureUrl).catch(() => undefined)
			: undefined;

	const assets: InvoicePdfAssets = {
		qrDataUrl,
		logo,
		stamp,
		signature,
	};

	const pdfStream = await pdf(<InvoicePdfDocument invoice={invoice} assets={assets} />).toBuffer();
	return streamToUint8Array(pdfStream);
}

function customizationAllows(
	flag: boolean | undefined,
	url?: string | undefined,
): boolean {
	const on = Boolean(flag);
	return on && typeof url === "string" && url.length > 0;
}
