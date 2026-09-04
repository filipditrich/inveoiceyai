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

  it("expands party details in edit mode and puts IČO under the address", () => {
    const invoice = parseInvoice(domesticFixture);
    const html = renderToStaticMarkup(
      createElement(LookDocumentView, {
        invoice,
        onEdit: () => undefined,
      }),
    );
    expect(html).toContain('placeholder="Název firmy"');
    expect(html).toContain('placeholder="Ulice a číslo"');
    expect(html).not.toContain("Adresa a identifikace");
    const issuer = html.split('data-look-block="issuer"')[1] ?? "";
    expect(issuer.indexOf("Název firmy")).toBeGreaterThan(-1);
    expect(issuer.indexOf("IČO")).toBeGreaterThan(
      issuer.indexOf("Název firmy"),
    );
  });

  it("edits dates as formatted text, not native date inputs", () => {
    const invoice = parseInvoice(domesticFixture);
    const html = renderToStaticMarkup(
      createElement(LookDocumentView, {
        invoice,
        onEdit: () => undefined,
      }),
    );
    expect(html).not.toContain('type="date"');
    expect(html).toContain("03. 05. 2026");
  });

  it("edits qty, price, and VAT as text so Classic columns stay on one row", () => {
    const invoice = parseInvoice(domesticFixture);
    const html = renderToStaticMarkup(
      createElement(LookDocumentView, {
        invoice,
        onEdit: () => undefined,
      }),
    );
    expect(html).not.toContain('type="number"');
    expect(html).toContain("2.2rem");
    expect(html).toContain("1000,00");
    expect(html).toContain('aria-label="Přidat položku"');
    expect(html).toContain("+ Přidat položku");
  });

  it("lays the line header and row on the same clipped grid", () => {
    const invoice = parseInvoice(domesticFixture);
    const html = renderToStaticMarkup(
      createElement(LookDocumentView, {
        invoice,
        onEdit: () => undefined,
      }),
    );
    const grid =
      "minmax(0, 42%) minmax(0, 15%) minmax(0, 18%) minmax(0, 6%) minmax(0, 19%)";
    expect(html.split(grid)).toHaveLength(3);
    expect(html).toContain("overflow:hidden");
  });

  it("keeps Invoice No. on one line and paints party names in Classic weight", () => {
    const invoice = parseInvoice(domesticFixture);
    const html = renderToStaticMarkup(
      createElement(LookDocumentView, {
        invoice,
        onEdit: () => undefined,
      }),
    );
    expect(html).toContain("white-space:nowrap");
    expect(html).toContain("font-weight:700");
    expect(html).toContain("Kč");
    expect(html).toContain("%");
  });

  it("collapses empty start/end columns so the title band is full width", () => {
    const invoice = parseInvoice(domesticFixture);
    const html = renderToStaticMarkup(
      createElement(LookDocumentView, { invoice }),
    );
    expect((html.match(/width:48%/g) ?? []).length).toBe(4);
    expect(html).toContain("width:100%");
  });

  it("hints an empty bank as a format, not a plausible account number", () => {
    const invoice = parseInvoice(domesticFixture);
    const html = renderToStaticMarkup(
      createElement(LookDocumentView, {
        invoice,
        onEdit: () => undefined,
      }),
    );
    expect(html).not.toContain('placeholder="123456789/0100"');
    expect(html).toContain('placeholder="číslo/kód banky"');
  });
});
