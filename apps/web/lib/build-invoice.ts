import {
	InvoiceSchema,
	type ClientSnapshot,
	type Invoice,
	type IssuerSnapshot,
} from "@invoicey/invoice-core/schema";
import { calcTotals } from "@invoicey/invoice-core/totals";

export type BuilderLineInput = {
	description: string;
	quantity: number;
	unit: string;
	unitPriceWithoutVat: number;
	vatRate: number;
};

export type BuilderInvoiceInput = {
	docType: Invoice["meta"]["docType"];
	number: string;
	issueDate: string;
	dueDate: string;
	duzp: string;
	issuer: IssuerSnapshot;
	client: ClientSnapshot;
	vatMode: Invoice["vat"]["mode"];
	suppliesAbroad: Invoice["vat"]["suppliesAbroad"];
	legalNote?: string;
	localReverseChargeCode?: string;
	items: BuilderLineInput[];
	notes?: string;
	correctedInvoiceNumber?: string;
	paymentMethod?: Invoice["payment"]["method"];
};

/** Assemble a Zod-validatable Invoice (or draft with provisional number). */
export function buildInvoicePayload(input: BuilderInvoiceInput): Invoice {
	const { items, totals } = calcTotals(
		input.items.map((line, i) => ({
			position: i + 1,
			description: line.description,
			quantity: line.quantity,
			unit: line.unit,
			unitPriceWithoutVat: line.unitPriceWithoutVat,
			vatRate: line.vatRate,
		})),
		{
			mode: input.vatMode,
			suppliesAbroad: input.suppliesAbroad,
			...(input.legalNote ? { legalNote: input.legalNote } : {}),
			...(input.localReverseChargeCode
				? { localReverseChargeCode: input.localReverseChargeCode }
				: {}),
		},
		input.issuer.vatPayer,
	);

	const method = input.paymentMethod ?? "transfer";
	const payment =
		method === "transfer"
			? {
					method: "transfer" as const,
					bankAccount: input.issuer.bank,
					variableSymbol: digitsOnly(input.number).slice(0, 10) || "0",
				}
			: { method };

	const candidate = {
		meta: {
			docType: input.docType,
			number: input.number,
			issueDate: input.issueDate,
			dueDate: input.dueDate,
			duzp: input.duzp,
			language: "cs" as const,
			currency: "CZK" as const,
			...(input.docType === "credit_note" && input.correctedInvoiceNumber
				? { correctedInvoiceNumber: input.correctedInvoiceNumber }
				: {}),
		},
		issuer: input.issuer,
		client: input.client,
		vat: {
			mode: input.vatMode,
			suppliesAbroad: input.suppliesAbroad,
			...(input.legalNote ? { legalNote: input.legalNote } : {}),
			...(input.localReverseChargeCode
				? { localReverseChargeCode: input.localReverseChargeCode }
				: {}),
		},
		payment,
		items,
		totals,
		...(input.notes ? { notes: input.notes } : {}),
	};

	return InvoiceSchema.parse(candidate);
}

export function tryBuildInvoicePayload(
	input: BuilderInvoiceInput,
): { ok: true; invoice: Invoice } | { ok: false; message: string } {
	try {
		return { ok: true, invoice: buildInvoicePayload(input) };
	} catch (e) {
		return {
			ok: false,
			message: e instanceof Error ? e.message : "invoice build failed",
		};
	}
}

function digitsOnly(s: string): string {
	return s.replace(/\D/g, "");
}

export function todayIsoDate(): string {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

export function addDaysIso(iso: string, days: number): string {
	const d = new Date(`${iso}T12:00:00.000Z`);
	d.setUTCDate(d.getUTCDate() + days);
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}
