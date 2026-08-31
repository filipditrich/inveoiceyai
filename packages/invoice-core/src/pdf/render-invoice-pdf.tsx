/** @jsxImportSource react */
import { pdf } from "@react-pdf/renderer";

import { renderIsdoc } from "../isdoc/render-isdoc";
import type { Invoice } from "../schema";
import { renderSpaydQr } from "../spayd/render-spayd-qr";

import { resolveLookDocument } from "../looks";
import { embedIsdocInPdf } from "./embed-isdoc-in-pdf";
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

/** Visual page only (react-pdf). Prefer {@link renderInvoicePdf} for PDF + embedded ISDOC. */
export async function renderVisualInvoicePdf(
  invoice: Invoice,
): Promise<Uint8Array> {
  registerInvoiceFonts();

  const look = resolveLookDocument(invoice);
  const qrDataUrl = look.theme.showQr
    ? await renderSpaydQr(invoice)
    : undefined;
  const logo = await loadImageForPdf(invoice.issuer.logoUrl).catch(
    () => undefined,
  );
  const stamp = look.theme.showStamp
    ? await loadImageForPdf(invoice.issuer.stampUrl).catch(() => undefined)
    : undefined;
  const signature = look.theme.showSignature
    ? await loadImageForPdf(invoice.issuer.signatureUrl).catch(() => undefined)
    : undefined;

  const assets: InvoicePdfAssets = {
    qrDataUrl,
    logo,
    stamp,
    signature,
  };

  const pdfStream = await pdf(
    <InvoicePdfDocument invoice={invoice} assets={assets} />,
  ).toBuffer();
  return streamToUint8Array(pdfStream);
}

/** Render invoice PDF with ISDOC XML attached as `invoice.isdoc`. */
export async function renderInvoicePdf(invoice: Invoice): Promise<Uint8Array> {
  const visual = await renderVisualInvoicePdf(invoice);
  const isdocXml = renderIsdoc(invoice);
  return embedIsdocInPdf(visual, isdocXml);
}
