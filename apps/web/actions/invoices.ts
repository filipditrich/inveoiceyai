"use server";

import {
	addDaysIso,
	buildInvoicePayload,
	todayIsoDate,
	type BuilderLineInput,
} from "@/lib/build-invoice";
import {
	ensureDefaultWorkspace,
	getDefaultWorkspaceId,
} from "@/lib/workspace-id";
import {
	ClientSnapshotSchema,
	InvoiceSchema,
	IssuerSnapshotSchema,
	nextInvoiceNumber,
	type Invoice,
} from "@invoicey/invoice-core";
import {
	cancelInvoiceById,
	markInvoicePaidById,
} from "@invoicey/invoice-tools/ops";
import { clients, invoiceItems, invoices, issuerBusinesses, issuerNumberingSchemes } from "@invoicey/db";
import { withDbTransaction, type DbTransaction } from "@invoicey/db/transaction";
import { db } from "@invoicey/db/client";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function optionalTrim(value: FormDataEntryValue | null): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const s = value.trim();
	return s.length > 0 ? s : undefined;
}

function parseLines(formData: FormData): BuilderLineInput[] {
	const raw = optionalTrim(formData.get("itemsJson"));
	if (!raw) {
		return [];
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw) as unknown;
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) {
		return [];
	}
	const lines: BuilderLineInput[] = [];
	for (const row of parsed) {
		if (!row || typeof row !== "object") {
			continue;
		}
		const r = row as Record<string, unknown>;
		const description =
			typeof r.description === "string" ? r.description.trim() : "";
		const quantity = Number(r.quantity);
		const unit = typeof r.unit === "string" ? r.unit.trim() : "ks";
		const unitPriceWithoutVat = Number(r.unitPriceWithoutVat);
		const vatRate = Number(r.vatRate);
		if (!description || !Number.isFinite(quantity) || quantity === 0) {
			continue;
		}
		if (!Number.isFinite(unitPriceWithoutVat) || unitPriceWithoutVat < 0) {
			continue;
		}
		if (!Number.isFinite(vatRate)) {
			continue;
		}
		lines.push({
			description,
			quantity,
			unit: unit || "ks",
			unitPriceWithoutVat,
			vatRate,
		});
	}
	return lines;
}

async function loadIssuerClient(
	workspaceId: string,
	issuerId: string,
	clientId: string,
) {
	const issuerRows = await db
		.select()
		.from(issuerBusinesses)
		.where(
			and(
				eq(issuerBusinesses.id, issuerId),
				eq(issuerBusinesses.workspaceId, workspaceId),
			),
		)
		.limit(1);
	const clientRows = await db
		.select()
		.from(clients)
		.where(and(eq(clients.id, clientId), eq(clients.workspaceId, workspaceId)))
		.limit(1);
	const issuerSnap = issuerRows[0]
		? IssuerSnapshotSchema.safeParse(issuerRows[0].snapshot)
		: null;
	const clientSnap = clientRows[0]
		? ClientSnapshotSchema.safeParse(clientRows[0].snapshot)
		: null;
	if (!issuerSnap?.success || !clientSnap?.success) {
		return null;
	}
	return { issuer: issuerSnap.data, client: clientSnap.data };
}

type DocType = Invoice["meta"]["docType"];
type VatMode = Invoice["vat"]["mode"];
type SuppliesAbroad = Invoice["vat"]["suppliesAbroad"];

function formToBuilderFields(formData: FormData): {
	issuerId: string | undefined;
	clientId: string | undefined;
	docType: DocType;
	issueDate: string;
	dueDate: string;
	duzp: string;
	vatMode: VatMode;
	suppliesAbroad: SuppliesAbroad;
	notes: string | undefined;
	legalNote: string | undefined;
	localReverseChargeCode: string | undefined;
	correctedInvoiceNumber: string | undefined;
	items: BuilderLineInput[];
} {
	const issuerId = optionalTrim(formData.get("issuerId"));
	const clientId = optionalTrim(formData.get("clientId"));
	const docTypeRaw = optionalTrim(formData.get("docType")) ?? "invoice";
	const docType: DocType =
		docTypeRaw === "proforma" ||
		docTypeRaw === "advance" ||
		docTypeRaw === "credit_note"
			? docTypeRaw
			: "invoice";
	const issueDate = optionalTrim(formData.get("issueDate")) ?? todayIsoDate();
	const dueDate =
		optionalTrim(formData.get("dueDate")) ?? addDaysIso(issueDate, 14);
	const duzp = optionalTrim(formData.get("duzp")) ?? issueDate;
	const vatModeRaw = optionalTrim(formData.get("vatMode")) ?? "regular";
	const vatMode: VatMode =
		vatModeRaw === "reverse_charge" || vatModeRaw === "oss"
			? vatModeRaw
			: "regular";
	const suppliesRaw = optionalTrim(formData.get("suppliesAbroad")) ?? "none";
	const suppliesAbroad: SuppliesAbroad =
		suppliesRaw === "eu" || suppliesRaw === "non_eu" ? suppliesRaw : "none";
	const notes = optionalTrim(formData.get("notes"));
	const legalNote = optionalTrim(formData.get("legalNote"));
	const localReverseChargeCode = optionalTrim(
		formData.get("localReverseChargeCode"),
	);
	const correctedInvoiceNumber = optionalTrim(
		formData.get("correctedInvoiceNumber"),
	);
	const items = parseLines(formData);
	return {
		issuerId,
		clientId,
		docType,
		issueDate,
		dueDate,
		duzp,
		vatMode,
		suppliesAbroad,
		notes,
		legalNote,
		localReverseChargeCode,
		correctedInvoiceNumber,
		items,
	};
}

function rowValuesFromInvoice(
	invoice: Invoice,
	opts: {
		id: string;
		workspaceId: string;
		issuerId: string;
		clientId: string;
		issuedAt: Date | null;
		paidAt: Date | null;
		cancelledAt: Date | null;
	},
) {
	return {
		id: opts.id,
		workspaceId: opts.workspaceId,
		issuerId: opts.issuerId,
		clientId: opts.clientId,
		docType: invoice.meta.docType,
		number: invoice.meta.number === "DRAFT" ? null : invoice.meta.number,
		issueDate: invoice.meta.issueDate,
		dueDate: invoice.meta.dueDate,
		duzp: invoice.meta.duzp,
		issuedAt: opts.issuedAt,
		paidAt: opts.paidAt,
		cancelledAt: opts.cancelledAt,
		currency: invoice.meta.currency,
		total: String(invoice.totals.total),
		subtotal: String(invoice.totals.subtotal),
		vatTotal: String(invoice.totals.vatTotal),
		clientName: invoice.client.name,
		notes: invoice.notes ?? null,
		issuerSnapshot: invoice.issuer as unknown as Record<string, unknown>,
		clientSnapshot: invoice.client as unknown as Record<string, unknown>,
		payloadJson: invoice as unknown as Record<string, unknown>,
		updatedAt: new Date(),
	};
}

async function replaceItems(
	tx: DbTransaction,
	invoiceId: string,
	invoice: Invoice,
) {
	await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
	if (invoice.items.length === 0) {
		return;
	}
	await tx.insert(invoiceItems).values(
		invoice.items.map((line) => ({
			id: crypto.randomUUID(),
			invoiceId,
			position: line.position,
			description: line.description,
			quantity: String(line.quantity),
			unit: line.unit,
			unitPriceWithoutVat: String(line.unitPriceWithoutVat),
			vatRate: String(line.vatRate),
			lineSubtotal: String(line.lineSubtotal),
			lineVat: String(line.lineVat),
			lineTotal: String(line.lineTotal),
		})),
	);
}

/** Persist draft without consuming a number. */
export async function saveInvoiceDraft(formData: FormData): Promise<void> {
	const workspaceId = await ensureDefaultWorkspace();
	const existingId = optionalTrim(formData.get("id"));
	const errBase =
		existingId !== undefined
			? `/invoices/${existingId}/edit`
			: "/invoices/new";
	const fields = formToBuilderFields(formData);
	if (!fields.issuerId || !fields.clientId || fields.items.length === 0) {
		redirect(`${errBase}?invalid=${encodeURIComponent("required_fields")}`);
	}

	const parties = await loadIssuerClient(
		workspaceId,
		fields.issuerId,
		fields.clientId,
	);
	if (!parties) {
		redirect(`${errBase}?invalid=${encodeURIComponent("missing_parties")}`);
	}

	let invoice: Invoice;
	try {
		invoice = buildInvoicePayload({
			docType: fields.docType,
			number: "DRAFT",
			issueDate: fields.issueDate,
			dueDate: fields.dueDate,
			duzp: fields.duzp,
			issuer: parties.issuer,
			client: parties.client,
			vatMode: fields.vatMode,
			suppliesAbroad: fields.suppliesAbroad,
			legalNote: fields.legalNote,
			localReverseChargeCode: fields.localReverseChargeCode,
			correctedInvoiceNumber: fields.correctedInvoiceNumber,
			items: fields.items,
			notes: fields.notes,
		});
	} catch {
		redirect(`${errBase}?invalid=${encodeURIComponent("validation")}`);
	}

	const id = existingId ?? crypto.randomUUID();

	try {
		await withDbTransaction(async (tx) => {
			if (existingId) {
				const existing = await tx
					.select()
					.from(invoices)
					.where(
						and(
							eq(invoices.id, existingId),
							eq(invoices.workspaceId, workspaceId),
						),
					)
					.limit(1);
				if (!existing[0]) {
					throw new Error("missing_row");
				}
				if (existing[0].issuedAt) {
					throw new Error("not_draft");
				}
				await tx
					.update(invoices)
					.set(
						rowValuesFromInvoice(invoice, {
							id,
							workspaceId,
							issuerId: fields.issuerId!,
							clientId: fields.clientId!,
							issuedAt: null,
							paidAt: existing[0].paidAt,
							cancelledAt: existing[0].cancelledAt,
						}),
					)
					.where(eq(invoices.id, id));
			} else {
				await tx.insert(invoices).values({
					...rowValuesFromInvoice(invoice, {
						id,
						workspaceId,
						issuerId: fields.issuerId!,
						clientId: fields.clientId!,
						issuedAt: null,
						paidAt: null,
						cancelledAt: null,
					}),
					createdAt: new Date(),
				});
			}
			await replaceItems(tx, id, invoice);
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : "save_failed";
		if (msg === "not_draft") {
			redirect(`/invoices/${id}?invalid=${encodeURIComponent("not_draft")}`);
		}
		redirect(`${errBase}?invalid=${encodeURIComponent(msg)}`);
	}

	revalidatePath("/invoices");
	redirect(`/invoices/${id}/edit`);
}

/** Issue: lock numbering, assign number, freeze snapshots. */
export async function issueInvoice(formData: FormData): Promise<void> {
	const workspaceId = await ensureDefaultWorkspace();
	const existingId = optionalTrim(formData.get("id"));
	const errBase =
		existingId !== undefined
			? `/invoices/${existingId}/edit`
			: "/invoices/new";
	const fields = formToBuilderFields(formData);
	if (!fields.issuerId || !fields.clientId || fields.items.length === 0) {
		redirect(`${errBase}?invalid=${encodeURIComponent("required_fields")}`);
	}

	if (existingId) {
		const existing = await db
			.select()
			.from(invoices)
			.where(
				and(eq(invoices.id, existingId), eq(invoices.workspaceId, workspaceId)),
			)
			.limit(1);
		if (existing[0]?.issuedAt) {
			redirect(`/invoices/${existingId}?invalid=${encodeURIComponent("already_issued")}`);
		}
	}

	const invoiceId = existingId ?? crypto.randomUUID();

	try {
		await withDbTransaction(async (tx) => {
			const issuerRows = await tx
				.select()
				.from(issuerBusinesses)
				.where(
					and(
						eq(issuerBusinesses.id, fields.issuerId!),
						eq(issuerBusinesses.workspaceId, workspaceId),
					),
				)
				.limit(1);
			const clientRows = await tx
				.select()
				.from(clients)
				.where(
					and(
						eq(clients.id, fields.clientId!),
						eq(clients.workspaceId, workspaceId),
					),
				)
				.limit(1);
			const issuerSnap = issuerRows[0]
				? IssuerSnapshotSchema.safeParse(issuerRows[0].snapshot)
				: null;
			const clientSnap = clientRows[0]
				? ClientSnapshotSchema.safeParse(clientRows[0].snapshot)
				: null;
			if (!issuerSnap?.success || !clientSnap?.success) {
				throw new Error("missing_parties");
			}

			const schemeRows = await tx
				.select()
				.from(issuerNumberingSchemes)
				.where(
					and(
						eq(issuerNumberingSchemes.issuerId, fields.issuerId!),
						eq(issuerNumberingSchemes.docType, fields.docType),
					),
				)
				.for("update")
				.limit(1);

			const scheme = schemeRows[0];
			if (!scheme) {
				throw new Error("missing_scheme");
			}

			const issueDate = new Date(`${fields.issueDate}T12:00:00.000Z`);
			const number = nextInvoiceNumber(
				{
					template: scheme.template,
					counter: scheme.counter,
					counterYear: scheme.counterYear ?? undefined,
					resetPeriod: scheme.resetPeriod === "never" ? "never" : "yearly",
					padding: scheme.padding,
					docType: fields.docType,
					issuerName: issuerSnap.data.name,
				},
				issueDate,
			);

			const year = issueDate.getFullYear();
			let nextCounter = scheme.counter + 1;
			let nextYear = scheme.counterYear;
			if (scheme.resetPeriod === "yearly") {
				if (scheme.counterYear !== null && scheme.counterYear !== year) {
					nextCounter = 1;
				}
				nextYear = year;
			}

			const invoice = buildInvoicePayload({
				docType: fields.docType,
				number,
				issueDate: fields.issueDate,
				dueDate: fields.dueDate,
				duzp: fields.duzp,
				issuer: issuerSnap.data,
				client: clientSnap.data,
				vatMode: fields.vatMode,
				suppliesAbroad: fields.suppliesAbroad,
				legalNote: fields.legalNote,
				localReverseChargeCode: fields.localReverseChargeCode,
				correctedInvoiceNumber: fields.correctedInvoiceNumber,
				items: fields.items,
				notes: fields.notes,
			});

			const parsed = InvoiceSchema.safeParse(invoice);
			if (!parsed.success) {
				throw new Error("validation");
			}

			const issuedAt = new Date();
			const values = rowValuesFromInvoice(parsed.data, {
				id: invoiceId,
				workspaceId,
				issuerId: fields.issuerId!,
				clientId: fields.clientId!,
				issuedAt,
				paidAt: null,
				cancelledAt: null,
			});

			if (existingId) {
				await tx.update(invoices).set(values).where(eq(invoices.id, invoiceId));
			} else {
				await tx.insert(invoices).values({ ...values, createdAt: new Date() });
			}

			await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
			await tx.insert(invoiceItems).values(
				parsed.data.items.map((line) => ({
					id: crypto.randomUUID(),
					invoiceId,
					position: line.position,
					description: line.description,
					quantity: String(line.quantity),
					unit: line.unit,
					unitPriceWithoutVat: String(line.unitPriceWithoutVat),
					vatRate: String(line.vatRate),
					lineSubtotal: String(line.lineSubtotal),
					lineVat: String(line.lineVat),
					lineTotal: String(line.lineTotal),
				})),
			);

			await tx
				.update(issuerNumberingSchemes)
				.set({
					counter: nextCounter,
					counterYear: nextYear,
					updatedAt: new Date(),
				})
				.where(eq(issuerNumberingSchemes.id, scheme.id));
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : "issue_failed";
		redirect(`${errBase}?invalid=${encodeURIComponent(msg)}`);
	}

	revalidatePath("/invoices");
	redirect(`/invoices/${invoiceId}`);
}

export async function markInvoicePaid(formData: FormData): Promise<void> {
	const id = optionalTrim(formData.get("id"));
	if (!id) {
		redirect(`/invoices?invalid=${encodeURIComponent("missing_id")}`);
	}
	const result = await markInvoicePaidById({ id });
	if (!result.ok) {
		redirect(`/invoices?invalid=${encodeURIComponent("cannot_mark_paid")}`);
	}
	revalidatePath("/invoices");
	revalidatePath(`/invoices/${id}`);
	redirect(`/invoices/${id}`);
}

/** Cancel an issued (unpaid) invoice. */
export async function cancelInvoice(formData: FormData): Promise<void> {
	const id = optionalTrim(formData.get("id"));
	if (!id) {
		redirect(`/invoices?invalid=${encodeURIComponent("missing_id")}`);
	}
	const result = await cancelInvoiceById({ id });
	if (!result.ok) {
		redirect(`/invoices?invalid=${encodeURIComponent("cannot_cancel")}`);
	}
	revalidatePath("/invoices");
	revalidatePath(`/invoices/${id}`);
	redirect(`/invoices/${id}`);
}

export async function deleteInvoice(formData: FormData): Promise<void> {
	const id = optionalTrim(formData.get("id"));
	const workspaceId = getDefaultWorkspaceId();
	if (!id) {
		redirect(`/invoices?invalid=${encodeURIComponent("missing_id")}`);
	}
	const rows = await db
		.select()
		.from(invoices)
		.where(and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)))
		.limit(1);
	if (!rows[0]) {
		redirect(`/invoices?invalid=${encodeURIComponent("missing_row")}`);
	}
	if (rows[0].issuedAt) {
		redirect(`/invoices?invalid=${encodeURIComponent("not_draft")}`);
	}
	await db.delete(invoices).where(eq(invoices.id, id));
	revalidatePath("/invoices");
	redirect("/invoices");
}

/** Duplicate issued or draft into a new draft. */
export async function duplicateInvoice(formData: FormData): Promise<void> {
	const id = optionalTrim(formData.get("id"));
	const workspaceId = getDefaultWorkspaceId();
	if (!id) {
		redirect(`/invoices?invalid=${encodeURIComponent("missing_id")}`);
	}
	const rows = await db
		.select()
		.from(invoices)
		.where(and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)))
		.limit(1);
	const row = rows[0];
	if (!row) {
		redirect(`/invoices?invalid=${encodeURIComponent("missing_row")}`);
	}
	const payload = InvoiceSchema.safeParse(row.payloadJson);
	if (!payload.success) {
		redirect(`/invoices?invalid=${encodeURIComponent("bad_payload")}`);
	}
	const draft: Invoice = {
		...payload.data,
		meta: { ...payload.data.meta, number: "DRAFT" },
	};
	const newId = crypto.randomUUID();
	await withDbTransaction(async (tx) => {
		await tx.insert(invoices).values({
			...rowValuesFromInvoice(draft, {
				id: newId,
				workspaceId,
				issuerId: row.issuerId,
				clientId: row.clientId,
				issuedAt: null,
				paidAt: null,
				cancelledAt: null,
			}),
			createdAt: new Date(),
		});
		await replaceItems(tx, newId, draft);
	});
	revalidatePath("/invoices");
	redirect(`/invoices/${newId}/edit`);
}
