import { describe, expect, it } from "vitest";

import creditNoteFixture from "./__fixtures__/invoices/credit-note.json";
import domesticFixture from "./__fixtures__/invoices/domestic-transfer.json";
import enDomesticFixture from "./__fixtures__/invoices/domestic-transfer-en.json";
import neplatceFixture from "./__fixtures__/invoices/neplatce-regular.json";
import proformaFixture from "./__fixtures__/invoices/proforma.json";
import reverseFixture from "./__fixtures__/invoices/reverse-charge.json";
import { createHash } from "node:crypto";

import type { Invoice } from "./schema";
import {
  renderInvoicePdf,
  renderIsdoc,
  validateIsdocXml,
  buildSpaydPayload,
  renderSpaydQr,
  stableIsdocInvoiceUuid,
  parseCzAccountNumber,
  InvoiceSchema,
} from ".";

function parseInvoice(raw: unknown): Invoice {
  const r = InvoiceSchema.safeParse(raw);
  if (!r.success) {
    console.error(JSON.stringify(r.error.flatten(), undefined, 2));
    expect.fail("fixture must satisfy InvoiceSchema");
  }
  return r.data;
}

const fixturesLabel = [
  ["domestic", domesticFixture],
  ["neplatce", neplatceFixture],
  ["reverse", reverseFixture],
  ["credit", creditNoteFixture],
  ["proforma", proformaFixture],
] as const;

describe("ISDOC XSD + snapshots", () => {
  it.each(fixturesLabel)("validates XSD for %s", async (_label, fixture) => {
    const invoice = parseInvoice(fixture);
    const xml = renderIsdoc(invoice);
    const res = await validateIsdocXml(xml);
    expect(res.ok, JSON.stringify(res.errors)).toBe(true);
    expect(xml).toContain('xmlns="http://isdoc.cz/namespace/2013"');
  });

  it("matches deterministic UUID", () => {
    const invoice = parseInvoice(domesticFixture);
    expect(stableIsdocInvoiceUuid(invoice)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu,
    );
  });

  it("parseCzAccountNumber accepts prefix and plain forms", () => {
    expect(parseCzAccountNumber("19-2000145399/0800")).toEqual({
      number: "19-2000145399",
      bankCode: "0800",
    });
    expect(parseCzAccountNumber("1920014539/0800")).toEqual({
      number: "1920014539",
      bankCode: "0800",
    });
  });

  it("parseCzAccountNumber throws on invalid input", () => {
    expect(() => parseCzAccountNumber("not-an-account")).toThrow(
      /invalid Czech account number/u,
    );
  });

  it.each(fixturesLabel)("snapshot renderIsdoc (%s)", (_label, fixture) => {
    const invoice = parseInvoice(fixture);
    expect(renderIsdoc(invoice)).toMatchSnapshot();
  });

  it("english invoice sets Note languageID and country name", () => {
    const invoice = parseInvoice(enDomesticFixture);
    const xml = renderIsdoc(invoice);
    expect(xml).toContain('languageID="en"');
    expect(xml).toContain("Czech Republic");
    expect(invoice.meta.language).toBe("en");
  });
});

describe("renderInvoicePdf", () => {
  it("embeds ISDOC XML as a PDF attachment", async () => {
    const invoice = parseInvoice(domesticFixture);
    const buf = await renderInvoicePdf(invoice);
    expect(buf.byteLength).toBeGreaterThan(3000);
    expect(String.fromCharCode(buf[0]!, buf[1]!, buf[2]!, buf[3]!)).toBe(
      "%PDF",
    );
    expect(Buffer.from(buf).includes(Buffer.from("/EmbeddedFile"))).toBe(true);
  });
});

describe("SPAYD", () => {
  it("returns null on credit_note / negative totals", () => {
    const credit = parseInvoice(creditNoteFixture);
    expect(buildSpaydPayload(credit)).toBeNull();
  });

  it("builds deterministic payload for transfers", () => {
    const invoice = parseInvoice(domesticFixture);
    const p = buildSpaydPayload(invoice);
    expect(p).toContain("SPD*1.0*");
    expect(p).toContain("*ACC:CZ9708000000001920014539+GIBACZPX*");
    expect(p).toContain("*AM:1210*");
    expect(p).toContain("*X-VS:20260001*");
    expect(p).toContain("*PT:IP*");
    expect(p).toContain("*MSG:Faktura 20260001 | NFCtron s.r.o.*");
    expect(p).toContain("*X-SELF:Faktura 20260001 | Filip Ditrich*");
    expect(p).not.toContain("*VS:");
    expect(p).not.toContain("*DT:");
    expect(buildSpaydPayload(invoice)).toBe(p);
  });

  it("renders issuer QR message templates with invoice variables", () => {
    const invoice = parseInvoice({
      ...domesticFixture,
      issuer: {
        ...domesticFixture.issuer,
        paymentQr: {
          beneficiaryMessageTemplate: "Doklad {number} od {client}",
          payerNoteTemplate: "Platba {number} pro {issuer}",
        },
      },
    });
    const payload = buildSpaydPayload(invoice);

    expect(payload).toContain("*MSG:Doklad 20260001 od NFCtron s.r.o.*");
    expect(payload).toContain("*X-SELF:Platba 20260001 pro Filip Ditrich*");
  });

  it("deterministic PNG data URL fingerprint for QR payload", async () => {
    const invoice = parseInvoice(domesticFixture);
    const qr = await renderSpaydQr(invoice);
    expect(qr?.startsWith("data:image/png;base64,")).toBe(true);
    expect(
      createHash("sha256").update(qr!, "utf8").digest("hex"),
    ).toMatchSnapshot();
  });
});
