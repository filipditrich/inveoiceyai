import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";

/** Paint a diagonal preview mark onto each page. Used for guest demo PDFs. */
export async function stampPdfWatermark(
  pdfBytes: Uint8Array,
  text: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const size = 42;
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: width / 2 - textWidth / 2,
      y: height / 2,
      size,
      font,
      color: rgb(0.07, 0.09, 0.15),
      opacity: 0.16,
      rotate: degrees(-28),
    });
  }
  return doc.save();
}
