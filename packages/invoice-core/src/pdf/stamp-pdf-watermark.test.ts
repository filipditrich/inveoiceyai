import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { stampPdfWatermark } from "./stamp-pdf-watermark";

function inflatedLatin1(pdf: Uint8Array): string {
  const raw = Buffer.from(pdf);
  const chunks: Buffer[] = [raw];
  const text = raw.toString("latin1");
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/gu;
  for (const match of text.matchAll(re)) {
    const body = match[1];
    if (!body) continue;
    try {
      chunks.push(inflateSync(Buffer.from(body, "latin1")));
    } catch {
      /** not a flate stream */
    }
  }
  return Buffer.concat(chunks).toString("latin1");
}

describe("stampPdfWatermark", () => {
  it("writes the mark into page content so Open PDF can show it", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const stamped = await stampPdfWatermark(await doc.save(), "PREVIEW");
    const inflated = inflatedLatin1(stamped);
    expect(inflated.toUpperCase()).toContain(
      Buffer.from("PREVIEW", "utf8").toString("hex").toUpperCase(),
    );
  });
});
