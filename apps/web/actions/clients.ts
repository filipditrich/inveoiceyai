"use server";

import { getDefaultWorkspaceId } from "@/lib/workspace-id";
import {
	ClientSnapshotSchema,
	ClientVatIdSchema,
	IcoSchema,
} from "@invoicey/invoice-core/schema";
import { clients } from "@invoicey/db";
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

function normalizeZip(zipRaw: string): string {
	const compact = zipRaw.replace(/\s/g, "");
	if (compact.length === 5 && /^\d{5}$/.test(compact)) {
		return `${compact.slice(0, 3)} ${compact.slice(3)}`;
	}
	return zipRaw.trim();
}

/** UPSERT validated `ClientSnapshot` in default workspace. */
export async function saveClient(formData: FormData): Promise<void> {
	const workspaceId = getDefaultWorkspaceId();
	const rowIdExisting = optionalTrim(formData.get("id"));
	const errBase =
		rowIdExisting !== undefined
			? `/clients/${rowIdExisting}/edit`
			: "/clients/new";

	const name =
		optionalTrim(formData.get("name")) ??
		null;
	const street =
		optionalTrim(formData.get("street")) ??
		null;
	const city =
		optionalTrim(formData.get("city")) ??
		null;
	const zipNorm = optionalTrim(formData.get("zip"));
	const zipResolved = zipNorm ? normalizeZip(zipNorm) : null;
	const country = (optionalTrim(formData.get("country")) ?? "CZ").toUpperCase();

	if (!name || !street || !city || !zipResolved) {
		redirect(`${errBase}?invalid=${encodeURIComponent("required_fields")}`);
	}

	let icoParsed: string | undefined;
	const icoRaw = optionalTrim(formData.get("ico"));
	if (icoRaw) {
		const i = IcoSchema.safeParse(icoRaw.replace(/\s/g, ""));
		if (!i.success) {
			redirect(`${errBase}?invalid=${encodeURIComponent("bad_ico")}`);
		}
		icoParsed = i.data;
	}

	let dicParsed: string | undefined;
	const dicRaw = optionalTrim(formData.get("dic"));
	if (dicRaw) {
		const d = ClientVatIdSchema.safeParse(dicRaw);
		if (!d.success) {
			redirect(`${errBase}?invalid=${encodeURIComponent("bad_dic")}`);
		}
		dicParsed = d.data;
	}

	const emailParsed = optionalTrim(formData.get("contactEmail"));

	const sourceLabelRaw = formData.get("source")?.toString();
	const sourceLabel = sourceLabelRaw === "ares" ? "ares" : "manual";

	const snapshotCandidate = ClientSnapshotSchema.safeParse({
		id: rowIdExisting ?? crypto.randomUUID(),
		name,
		...(icoParsed !== undefined ? { ico: icoParsed } : {}),
		...(dicParsed !== undefined ? { dic: dicParsed } : {}),
		address: {
			street,
			city,
			zip: zipResolved,
			country,
		},
		...(emailParsed !== undefined ? { contactEmail: emailParsed } : {}),
	});

	if (!snapshotCandidate.success) {
		redirect(`${errBase}?invalid=${encodeURIComponent("snapshot_validation")}`);
	}

	const snapshot = snapshotCandidate.data;

	if (rowIdExisting) {
		const existing = await db
			.select()
			.from(clients)
			.where(
				and(eq(clients.id, rowIdExisting), eq(clients.workspaceId, workspaceId)),
			)
			.limit(1);

		if (!existing[0]) {
			redirect(`/clients?invalid=${encodeURIComponent("missing_row")}`);
		}

		await db
			.update(clients)
			.set({
				snapshot,
				source: sourceLabel === "ares" ? "ares" : "manual",
				updatedAt: new Date(),
			})
			.where(
				and(eq(clients.id, rowIdExisting), eq(clients.workspaceId, workspaceId)),
			);
	} else {
		await db.insert(clients).values({
			id: snapshot.id,
			workspaceId,
			source: sourceLabel === "ares" ? "ares" : "manual",
			snapshot: snapshot as Record<string, unknown>,
		});
	}

	revalidatePath("/clients");
	redirect("/clients");
}

export async function deleteClient(formData: FormData): Promise<void> {
	const id = optionalTrim(formData.get("id"));
	const workspaceId = getDefaultWorkspaceId();
	if (!id) {
		redirect(`/clients?invalid=${encodeURIComponent("missing_id")}`);
	}
	await db.delete(clients).where(
		and(eq(clients.id, id), eq(clients.workspaceId, workspaceId)),
	);
	revalidatePath("/clients");
	redirect("/clients");
}
