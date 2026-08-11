"use server";

import {
	DEFAULT_NUMBERING_TEMPLATES,
	ISSUER_DOC_TYPES,
	type IssuerDocType,
} from "@/lib/issuer-numbering";
import { requireWorkspace } from "@/lib/auth/session";
import {
	BankAccountSchema,
	DicSchema,
	IcoSchema,
	IssuerSnapshotSchema,
} from "@invoicey/invoice-core/schema";
import { invoices, issuerBusinesses, issuerNumberingSchemes } from "@invoicey/db";
import { withDbTransaction } from "@invoicey/db/transaction";
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

function normalizeZip(zipRaw: string): string {
	const compact = zipRaw.replace(/\s/g, "");
	if (compact.length === 5 && /^\d{5}$/.test(compact)) {
		return `${compact.slice(0, 3)} ${compact.slice(3)}`;
	}
	return zipRaw.trim();
}

function hashesForPadding(padding: number): string {
	return `{${"#".repeat(padding)}}`;
}

function templateWithPadding(base: string, padding: number): string {
	const hashes = hashesForPadding(padding);
	if (/\{#+\}/.test(base)) {
		return base.replace(/\{#+\}/, hashes);
	}
	return `${base}${hashes}`;
}

async function upsertNumberingScheme(
	tx: Parameters<Parameters<typeof withDbTransaction>[0]>[0],
	opts: {
		workspaceId: string;
		issuerId: string;
		docType: IssuerDocType;
		formData: FormData;
	},
): Promise<void> {
	const { workspaceId, issuerId, docType, formData } = opts;
	const templateRaw =
		optionalTrim(formData.get(`scheme_${docType}_template`)) ??
		DEFAULT_NUMBERING_TEMPLATES[docType];
	const resetPeriodRaw =
		optionalTrim(formData.get(`scheme_${docType}_resetPeriod`)) ?? "yearly";
	const resetPeriod = resetPeriodRaw === "never" ? "never" : "yearly";
	const paddingRaw = Number(
		optionalTrim(formData.get(`scheme_${docType}_padding`)) ?? "4",
	);
	const padding =
		Number.isFinite(paddingRaw) && paddingRaw >= 1 && paddingRaw <= 10
			? Math.floor(paddingRaw)
			: 4;
	const counterRaw = Number(
		optionalTrim(formData.get(`scheme_${docType}_counter`)) ?? "0",
	);
	const counter =
		Number.isFinite(counterRaw) && counterRaw >= 0
			? Math.floor(counterRaw)
			: 0;
	const counterYearRaw = optionalTrim(
		formData.get(`scheme_${docType}_counterYear`),
	);
	const counterYear =
		resetPeriod === "yearly"
			? Number(counterYearRaw ?? String(new Date().getFullYear()))
			: null;
	const template = templateWithPadding(templateRaw, padding);

	const existingScheme = await tx
		.select()
		.from(issuerNumberingSchemes)
		.where(
			and(
				eq(issuerNumberingSchemes.issuerId, issuerId),
				eq(issuerNumberingSchemes.docType, docType),
			),
		)
		.limit(1);

	if (existingScheme[0]) {
		await tx
			.update(issuerNumberingSchemes)
			.set({
				template,
				resetPeriod,
				counter,
				counterYear: counterYear ?? null,
				padding,
				updatedAt: new Date(),
			})
			.where(eq(issuerNumberingSchemes.id, existingScheme[0].id));
		return;
	}

	await tx.insert(issuerNumberingSchemes).values({
		id: crypto.randomUUID(),
		workspaceId,
		issuerId,
		docType,
		template,
		resetPeriod,
		counter,
		counterYear: counterYear ?? null,
		padding,
	});
}

/** UPSERT validated IssuerSnapshot + numbering schemes in default workspace. */
export async function saveIssuer(formData: FormData): Promise<void> {
	const { workspaceId } = await requireWorkspace();
	const rowId = optionalTrim(formData.get("id")) ?? crypto.randomUUID();
	const hadId = optionalTrim(formData.get("id")) !== undefined;
	const errBase = hadId ? `/issuers/${rowId}/edit` : "/issuers/new";

	const name = optionalTrim(formData.get("name")) ?? null;
	const street = optionalTrim(formData.get("street")) ?? null;
	const city = optionalTrim(formData.get("city")) ?? null;
	const zipNorm = optionalTrim(formData.get("zip"));
	const zipResolved = zipNorm ? normalizeZip(zipNorm) : null;
	const contactEmail = optionalTrim(formData.get("contactEmail")) ?? null;
	const accountNumber = optionalTrim(formData.get("accountNumber")) ?? null;
	const iban = optionalTrim(formData.get("iban")) ?? null;
	const bic = optionalTrim(formData.get("bic"));
	const registryNote = optionalTrim(formData.get("registryNote"));
	const logoUrl = optionalTrim(formData.get("logoUrl"));
	const stampUrl = optionalTrim(formData.get("stampUrl"));
	const signatureUrl = optionalTrim(formData.get("signatureUrl"));
	const vatPayer =
		formData.get("vatPayer") === "on" || formData.get("vatPayer") === "true";

	if (
		!name ||
		!street ||
		!city ||
		!zipResolved ||
		!contactEmail ||
		!accountNumber ||
		!iban
	) {
		redirect(`${errBase}?invalid=${encodeURIComponent("required_fields")}`);
	}

	const icoRaw = optionalTrim(formData.get("ico"));
	if (!icoRaw) {
		redirect(`${errBase}?invalid=${encodeURIComponent("bad_ico")}`);
	}
	const icoParsed = IcoSchema.safeParse(icoRaw.replace(/\s/g, ""));
	if (!icoParsed.success) {
		redirect(`${errBase}?invalid=${encodeURIComponent("bad_ico")}`);
	}

	let dicParsed: string | undefined;
	const dicRaw = optionalTrim(formData.get("dic"));
	if (dicRaw) {
		const d = DicSchema.safeParse(dicRaw);
		if (!d.success) {
			redirect(`${errBase}?invalid=${encodeURIComponent("bad_dic")}`);
		}
		dicParsed = d.data;
	}

	const bankParsed = BankAccountSchema.safeParse({
		accountNumber,
		iban: iban.replace(/\s/g, "").toUpperCase(),
		...(bic !== undefined ? { bic: bic.toUpperCase() } : {}),
	});
	if (!bankParsed.success) {
		redirect(`${errBase}?invalid=${encodeURIComponent("bad_bank")}`);
	}

	const sourceLabelRaw = formData.get("source")?.toString();
	const sourceLabel = sourceLabelRaw === "ares" ? "ares" : "manual";

	const snapshotCandidate = IssuerSnapshotSchema.safeParse({
		id: rowId,
		name,
		ico: icoParsed.data,
		...(dicParsed !== undefined ? { dic: dicParsed } : {}),
		address: {
			street,
			city,
			zip: zipResolved,
			country: "CZ",
		},
		bank: bankParsed.data,
		vatPayer,
		contactEmail,
		...(registryNote !== undefined ? { registryNote } : {}),
		...(logoUrl !== undefined ? { logoUrl } : {}),
		...(stampUrl !== undefined ? { stampUrl } : {}),
		...(signatureUrl !== undefined ? { signatureUrl } : {}),
	});

	if (!snapshotCandidate.success) {
		redirect(`${errBase}?invalid=${encodeURIComponent("snapshot_validation")}`);
	}

	const snapshot = snapshotCandidate.data;
	const issuerId = snapshot.id;

	try {
		await withDbTransaction(async (tx) => {
			const existing = await tx
				.select({ id: issuerBusinesses.id })
				.from(issuerBusinesses)
				.where(
					and(
						eq(issuerBusinesses.id, issuerId),
						eq(issuerBusinesses.workspaceId, workspaceId),
					),
				)
				.limit(1);

			if (existing[0]) {
				await tx
					.update(issuerBusinesses)
					.set({
						snapshot: snapshot as Record<string, unknown>,
						source: sourceLabel,
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(issuerBusinesses.id, issuerId),
							eq(issuerBusinesses.workspaceId, workspaceId),
						),
					);
			} else {
				await tx.insert(issuerBusinesses).values({
					id: issuerId,
					workspaceId,
					source: sourceLabel,
					snapshot: snapshot as Record<string, unknown>,
				});
			}

			for (const docType of ISSUER_DOC_TYPES) {
				await upsertNumberingScheme(tx, {
					workspaceId,
					issuerId,
					docType,
					formData,
				});
			}
		});
	} catch (err) {
		console.error("[saveIssuer] failed", err);
		redirect(`${errBase}?invalid=${encodeURIComponent("save_failed")}`);
	}

	revalidatePath("/issuers");
	revalidatePath("/dashboard");
	revalidatePath("/invoices/new");
	redirect("/issuers?toast=issuer_saved");
}

/** Delete issuer when it has no invoices; cascades numbering schemes. */
export async function deleteIssuer(formData: FormData): Promise<void> {
	const id = optionalTrim(formData.get("id"));
	const { workspaceId } = await requireWorkspace();
	if (!id) {
		redirect(`/issuers?invalid=${encodeURIComponent("missing_id")}`);
	}

	const linked = await withDbTransaction(async (tx) => {
		const found = await tx
			.select({ id: invoices.id })
			.from(invoices)
			.where(
				and(eq(invoices.issuerId, id), eq(invoices.workspaceId, workspaceId)),
			)
			.limit(1);
		if (found[0]) {
			return true;
		}
		await tx
			.delete(issuerBusinesses)
			.where(
				and(
					eq(issuerBusinesses.id, id),
					eq(issuerBusinesses.workspaceId, workspaceId),
				),
			);
		return false;
	});

	if (linked) {
		redirect(`/issuers?invalid=${encodeURIComponent("has_invoices")}`);
	}

	revalidatePath("/issuers");
	revalidatePath("/dashboard");
	redirect("/issuers?toast=issuer_deleted");
}
