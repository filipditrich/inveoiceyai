import { uniquePdfFileNames } from "../render-batch";
import type { Invoice } from "../schema";
import { renderInvoicePdf } from "./render-invoice-pdf";

export type RenderedInvoicePdf = {
  filename: string;
  bytes: Uint8Array;
};

/** Render each invoice to ISDOC.PDF. Sequential to keep memory flat. */
export async function renderInvoicePdfBatch(
  invoices: readonly Invoice[],
): Promise<RenderedInvoicePdf[]> {
  const filenames = uniquePdfFileNames(invoices);
  const files: RenderedInvoicePdf[] = [];
  for (const [index, invoice] of invoices.entries()) {
    files.push({
      filename: filenames[index] ?? `invoice_${index + 1}.pdf`,
      bytes: await renderInvoicePdf(invoice),
    });
  }
  return files;
}
