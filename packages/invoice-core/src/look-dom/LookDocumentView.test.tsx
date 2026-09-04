import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import domesticFixture from "../__fixtures__/invoices/domestic-transfer.json";
import { CLASSIC_LOOK_1_0_0, LOOK_BLOCKS, lookHasBlock } from "../looks";
import { InvoiceSchema, type Invoice } from "../schema";
import { LookDocumentView } from "./LookDocumentView";

function parseInvoice(raw: unknown): Invoice {
  const parsed = InvoiceSchema.safeParse(raw);
  if (!parsed.success) {
    expect.fail("fixture must satisfy InvoiceSchema");
  }
  return parsed.data;
}

function blockOrder(html: string): string[] {
  const matches = [...html.matchAll(/data-look-block="([^"]+)"/gu)];
  return matches.map((match) => match[1] ?? "");
}

describe("LookDocumentView", () => {
  it("renders Classic blocks in layout order", () => {
    const invoice = parseInvoice(domesticFixture);
    const html = renderToStaticMarkup(
      createElement(LookDocumentView, { invoice }),
    );
    const rendered = blockOrder(html);
    const expected = CLASSIC_LOOK_1_0_0.layout.bands.flatMap((band) => {
      if (band.type === "footer") return ["footer"];
      const slots =
        band.type === "stack" ? band.slots : [...band.start, ...band.end];
      return slots
        .map((slot) => slot.block)
        .filter((id) => {
          if (id === "logo" || id === "stamp" || id === "signature")
            return false;
          if (id === "qr") return false;
          if (
            id === "tax" &&
            invoice.vat.mode === "regular" &&
            invoice.issuer.vatPayer
          ) {
            return false;
          }
          if (id === "notes" && !invoice.notes) return false;
          return lookHasBlock(CLASSIC_LOOK_1_0_0, id);
        });
    });
    expect(rendered).toEqual(expected);
    expect(LOOK_BLOCKS.includes("totals")).toBe(true);
  });

  it("marks totals and tax as not editable when the page is in edit mode", () => {
    const invoice = parseInvoice(domesticFixture);
    const html = renderToStaticMarkup(
      createElement(LookDocumentView, {
        invoice,
        onEdit: () => undefined,
      }),
    );
    expect(html).toContain('data-look-block="totals"');
    expect(html).toContain('data-look-editable="false"');
    expect(html).not.toMatch(
      /data-look-block="totals"[^>]*data-look-editable="true"/u,
    );
    expect(html).toContain('data-look-block="issuer"');
    expect(html).toContain("<input");
  });

  it("puts IČO first in edit mode and keeps address collapsed", () => {
    const invoice = parseInvoice(domesticFixture);
    const html = renderToStaticMarkup(
      createElement(LookDocumentView, {
        invoice,
        onEdit: () => undefined,
      }),
    );
    expect(html).toContain('placeholder="Název firmy"');
    expect(html).toContain("Adresa a identifikace");
    expect(html).not.toContain('placeholder="Ulice a číslo"');
    const issuer = html.split('data-look-block="issuer"')[1] ?? "";
    expect(issuer.indexOf("IČO")).toBeGreaterThan(-1);
    expect(issuer.indexOf("IČO")).toBeLessThan(issuer.indexOf("Název firmy"));
  });
});
