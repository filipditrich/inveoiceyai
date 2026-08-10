import { describe, expect, it } from "vitest";

import creditNoteFixture from "./__fixtures__/invoices/credit-note.json";
import domesticFixture from "./__fixtures__/invoices/domestic-transfer.json";
import neplatceFixture from "./__fixtures__/invoices/neplatce-regular.json";
import proformaFixture from "./__fixtures__/invoices/proforma.json";
import reverseFixture from "./__fixtures__/invoices/reverse-charge.json";
import { createHash } from "node:crypto";

import type { Invoice } from "./schema";
import {
	extractEmbeddedIsdoc,
	ISDOC_EMBEDDED_FILENAME,
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
});

describe("renderInvoicePdf", () => {
	it("produces ISDOC.PDF with extractable invoice.isdoc", async () => {
		const invoice = parseInvoice(domesticFixture);
		const buf = await renderInvoicePdf(invoice);
		expect(buf.byteLength).toBeGreaterThan(3000);
		expect(String.fromCharCode(buf[0]!, buf[1]!, buf[2]!, buf[3]!)).toBe("%PDF");

		const latin1 = Buffer.from(buf).toString("latin1");
		expect(latin1).toContain("/Type /EmbeddedFile");
		expect(latin1).toContain(ISDOC_EMBEDDED_FILENAME);
		expect(latin1).toContain("/AF");
		expect(latin1).toContain("/AFRelationship");
		expect(latin1).toContain("/Alternative");
		expect(latin1).toContain("pdfaid");
		expect(latin1).toContain("/OutputIntents");

		const embedded = await extractEmbeddedIsdoc(buf);
		expect(embedded).toBeTruthy();
		expect(embedded).toBe(renderIsdoc(invoice));
		const res = await validateIsdocXml(embedded!);
		expect(res.ok, JSON.stringify(res.errors)).toBe(true);
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
		expect(p).toContain("*ACC:CZ6508000000192000145399+GIBACZPX*");
		expect(p).toContain("*AM:1210*");
		expect(buildSpaydPayload(invoice)).toBe(p);
	});

	it("deterministic PNG data URL fingerprint for QR payload", async () => {
		const invoice = parseInvoice(domesticFixture);
		const qr = await renderSpaydQr(invoice);
		expect(qr?.startsWith("data:image/png;base64,")).toBe(true);
		expect(createHash("sha256").update(qr!, "utf8").digest("hex")).toMatchSnapshot();
	});
});
