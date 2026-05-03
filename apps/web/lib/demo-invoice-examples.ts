import { InvoiceSchema, type Invoice } from "@invoicey/invoice-core/schema";

import demoSampleInvoice from "@/lib/demo-sample-invoice.json";

interface InvoiceDemoExample {
	id: string;
	label: string;
	invoice: Invoice;
}

const baseInvoice = InvoiceSchema.parse(demoSampleInvoice);

function cloneBaseInvoice(): Invoice {
	return structuredClone(baseInvoice);
}

function makeRegularVatPayer(): Invoice {
	const invoice = cloneBaseInvoice();
	invoice.meta.number = "20260023";
	invoice.meta.issueDate = "2026-01-30";
	invoice.meta.dueDate = "2026-03-01";
	invoice.meta.duzp = "2026-01-30";
	invoice.issuer.name = "Pokojovky s.r.o.";
	invoice.issuer.vatPayer = true;
	invoice.issuer.dic = "CZ08034273";
	invoice.issuer.ico = "08034273";
	invoice.client.name = "NFCtron a.s.";
	invoice.client.contactEmail = "ucetnictvi@nfctron.com";
	invoice.payment.variableSymbol = "20260023";
	invoice.items = [
		{
			position: 1,
			description: "S: Péče o interiérové rostliny / leden",
			quantity: 1,
			unit: "ks",
			unitPriceWithoutVat: 11000,
			vatRate: 21,
			lineSubtotal: 11000,
			lineVat: 2310,
			lineTotal: 13310,
		},
	];
	invoice.totals = {
		subtotal: 11000,
		vatBreakdown: [{ rate: 21, base: 11000, vat: 2310 }],
		vatTotal: 2310,
		total: 13310,
	};
	return invoice;
}

function makeRegularMixedVat(): Invoice {
	const invoice = cloneBaseInvoice();
	invoice.meta.number = "20260024";
	invoice.meta.issueDate = "2026-02-02";
	invoice.meta.dueDate = "2026-02-16";
	invoice.meta.duzp = "2026-02-02";
	invoice.issuer.vatPayer = true;
	invoice.issuer.dic = "CZ09870113";
	invoice.client.name = "Acme Czech Republic s.r.o.";
	invoice.client.contactEmail = "finance@acme.example";
	invoice.items = [
		{
			position: 1,
			description: "Implementace invoice workflow",
			quantity: 1,
			unit: "ks",
			unitPriceWithoutVat: 18000,
			vatRate: 21,
			lineSubtotal: 18000,
			lineVat: 3780,
			lineTotal: 21780,
		},
		{
			position: 2,
			description: "Konzultace compliance",
			quantity: 4,
			unit: "h",
			unitPriceWithoutVat: 1500,
			vatRate: 12,
			lineSubtotal: 6000,
			lineVat: 720,
			lineTotal: 6720,
		},
	];
	invoice.totals = {
		subtotal: 24000,
		vatBreakdown: [
			{ rate: 12, base: 6000, vat: 720 },
			{ rate: 21, base: 18000, vat: 3780 },
		],
		vatTotal: 4500,
		total: 28500,
	};
	return invoice;
}

function makeProforma(): Invoice {
	const invoice = cloneBaseInvoice();
	invoice.meta.docType = "proforma";
	invoice.meta.number = "PF20260008";
	invoice.meta.issueDate = "2026-03-04";
	invoice.meta.dueDate = "2026-03-18";
	invoice.meta.duzp = "2026-03-04";
	invoice.issuer.vatPayer = true;
	invoice.issuer.dic = "CZ09870113";
	invoice.payment.method = "card";
	delete invoice.payment.bankAccount;
	delete invoice.payment.variableSymbol;
	invoice.items = [
		{
			position: 1,
			description: "Záloha na vývoj interního dashboardu",
			quantity: 1,
			unit: "ks",
			unitPriceWithoutVat: 12000,
			vatRate: 21,
			lineSubtotal: 12000,
			lineVat: 2520,
			lineTotal: 14520,
		},
	];
	invoice.totals = {
		subtotal: 12000,
		vatBreakdown: [{ rate: 21, base: 12000, vat: 2520 }],
		vatTotal: 2520,
		total: 14520,
	};
	return invoice;
}

function makeAdvance(): Invoice {
	const invoice = cloneBaseInvoice();
	invoice.meta.docType = "advance";
	invoice.meta.number = "ZF20260002";
	invoice.meta.issueDate = "2026-04-10";
	invoice.meta.dueDate = "2026-04-24";
	invoice.meta.duzp = "2026-04-10";
	invoice.issuer.vatPayer = true;
	invoice.issuer.dic = "CZ09870113";
	invoice.payment.method = "cash";
	delete invoice.payment.bankAccount;
	delete invoice.payment.variableSymbol;
	invoice.items = [
		{
			position: 1,
			description: "Záloha na provozní audit",
			quantity: 1,
			unit: "ks",
			unitPriceWithoutVat: 8000,
			vatRate: 21,
			lineSubtotal: 8000,
			lineVat: 1680,
			lineTotal: 9680,
		},
	];
	invoice.totals = {
		subtotal: 8000,
		vatBreakdown: [{ rate: 21, base: 8000, vat: 1680 }],
		vatTotal: 1680,
		total: 9680,
	};
	return invoice;
}

function makeReverseCharge(): Invoice {
	const invoice = cloneBaseInvoice();
	invoice.meta.number = "20260035";
	invoice.meta.issueDate = "2026-05-12";
	invoice.meta.dueDate = "2026-05-26";
	invoice.meta.duzp = "2026-05-12";
	invoice.issuer.vatPayer = true;
	invoice.issuer.dic = "CZ09870113";
	invoice.client.name = "Berlin Event GmbH";
	invoice.client.dic = "DE123456789";
	invoice.client.address.country = "DE";
	invoice.client.address.zip = "10115";
	invoice.vat.mode = "reverse_charge";
	invoice.vat.suppliesAbroad = "eu";
	invoice.vat.legalNote = "Daň odvede zákazník v režimu reverse charge.";
	invoice.items = [
		{
			position: 1,
			description: "Technický support event aplikace",
			quantity: 2,
			unit: "den",
			unitPriceWithoutVat: 12500,
			vatRate: 0,
			lineSubtotal: 25000,
			lineVat: 0,
			lineTotal: 25000,
		},
	];
	invoice.totals = {
		subtotal: 25000,
		vatBreakdown: [{ rate: 0, base: 25000, vat: 0 }],
		vatTotal: 0,
		total: 25000,
	};
	return invoice;
}

function makeOss(): Invoice {
	const invoice = cloneBaseInvoice();
	invoice.meta.number = "20260041";
	invoice.meta.issueDate = "2026-05-20";
	invoice.meta.dueDate = "2026-06-03";
	invoice.meta.duzp = "2026-05-20";
	invoice.issuer.vatPayer = true;
	invoice.issuer.dic = "CZ09870113";
	invoice.client.name = "Studio Lyon SARL";
	invoice.client.dic = "FR56321458963";
	invoice.client.address.country = "FR";
	invoice.client.address.zip = "69001";
	invoice.vat.mode = "oss";
	invoice.vat.suppliesAbroad = "eu";
	invoice.vat.legalNote = "Zdaněno v režimu OSS.";
	invoice.items = [
		{
			position: 1,
			description: "SaaS předplatné / květen",
			quantity: 1,
			unit: "měs",
			unitPriceWithoutVat: 5400,
			vatRate: 21,
			lineSubtotal: 5400,
			lineVat: 1134,
			lineTotal: 6534,
		},
	];
	invoice.totals = {
		subtotal: 5400,
		vatBreakdown: [{ rate: 21, base: 5400, vat: 1134 }],
		vatTotal: 1134,
		total: 6534,
	};
	return invoice;
}

function makeCreditNote(): Invoice {
	const invoice = cloneBaseInvoice();
	invoice.meta.docType = "credit_note";
	invoice.meta.number = "DN20260005";
	invoice.meta.correctedInvoiceNumber = "20260024";
	invoice.meta.issueDate = "2026-05-28";
	invoice.meta.dueDate = "2026-05-28";
	invoice.meta.duzp = "2026-05-28";
	invoice.issuer.vatPayer = true;
	invoice.issuer.dic = "CZ09870113";
	invoice.items = [
		{
			position: 1,
			description: "Dobropis: sleva za SLA incident",
			quantity: -1,
			unit: "ks",
			unitPriceWithoutVat: 3000,
			vatRate: 21,
			lineSubtotal: -3000,
			lineVat: -630,
			lineTotal: -3630,
		},
	];
	invoice.totals = {
		subtotal: -3000,
		vatBreakdown: [{ rate: 21, base: -3000, vat: -630 }],
		vatTotal: -630,
		total: -3630,
	};
	return invoice;
}

function makeNoBuyerIdsNoEmail(): Invoice {
	const invoice = cloneBaseInvoice();
	invoice.meta.number = "20260050";
	invoice.meta.issueDate = "2026-06-03";
	invoice.meta.dueDate = "2026-06-17";
	invoice.meta.duzp = "2026-06-03";
	invoice.issuer.vatPayer = false;
	delete invoice.issuer.dic;
	invoice.client.name = "Martin Horák";
	delete invoice.client.ico;
	delete invoice.client.dic;
	delete invoice.client.contactEmail;
	invoice.payment.method = "transfer";
	invoice.payment.variableSymbol = "20260050";
	invoice.items = [
		{
			position: 1,
			description: "Individuální konzultace",
			quantity: 3,
			unit: "h",
			unitPriceWithoutVat: 1200,
			vatRate: 0,
			lineSubtotal: 3600,
			lineVat: 0,
			lineTotal: 3600,
		},
	];
	invoice.totals = {
		subtotal: 3600,
		vatBreakdown: [{ rate: 0, base: 3600, vat: 0 }],
		vatTotal: 0,
		total: 3600,
	};
	return invoice;
}

export const demoInvoiceExamples: InvoiceDemoExample[] = [
	{ id: "basic-non-vat", label: "Neplátce · transfer · 0% DPH", invoice: cloneBaseInvoice() },
	{ id: "regular-vat-payer", label: "Plátce DPH · 21% · 1 položka", invoice: makeRegularVatPayer() },
	{ id: "regular-mixed-vat", label: "Plátce DPH · mix 12% + 21%", invoice: makeRegularMixedVat() },
	{ id: "proforma-card", label: "Proforma · platba kartou", invoice: makeProforma() },
	{ id: "advance-cash", label: "Zálohová · hotovost", invoice: makeAdvance() },
	{ id: "reverse-charge", label: "Reverse charge · EU odběratel", invoice: makeReverseCharge() },
	{ id: "oss-eu", label: "OSS · EU odběratel", invoice: makeOss() },
	{ id: "credit-note", label: "Dobropis · záporné částky", invoice: makeCreditNote() },
	{ id: "minimal-buyer", label: "Bez IČO/DIČ/email odběratele", invoice: makeNoBuyerIdsNoEmail() },
];

