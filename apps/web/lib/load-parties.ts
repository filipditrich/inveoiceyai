import type { ClientOption, IssuerOption } from "@/lib/invoice-party-types";
import { getDefaultWorkspaceId } from "@/lib/workspace-id";
import {
	ClientSnapshotSchema,
	IssuerSnapshotSchema,
} from "@invoicey/invoice-core/schema";
import {
	clients,
	db,
	issuerBusinesses,
	issuerNumberingSchemes,
} from "@invoicey/db";
import { eq } from "drizzle-orm";

export async function loadIssuerOptions(): Promise<IssuerOption[]> {
	const workspaceId = getDefaultWorkspaceId();
	const rows = await db
		.select()
		.from(issuerBusinesses)
		.where(eq(issuerBusinesses.workspaceId, workspaceId));
	const schemes = await db
		.select()
		.from(issuerNumberingSchemes)
		.where(eq(issuerNumberingSchemes.workspaceId, workspaceId));

	const byIssuer = new Map<string, typeof schemes>();
	for (const s of schemes) {
		const list = byIssuer.get(s.issuerId) ?? [];
		list.push(s);
		byIssuer.set(s.issuerId, list);
	}

	const out: IssuerOption[] = [];
	for (const r of rows) {
		const snap = IssuerSnapshotSchema.safeParse(r.snapshot);
		if (!snap.success) {
			continue;
		}
		out.push({
			id: r.id,
			snapshot: snap.data,
			schemes: (byIssuer.get(r.id) ?? []).map((s) => ({
				docType: s.docType,
				template: s.template,
				counter: s.counter,
				counterYear: s.counterYear,
				resetPeriod: s.resetPeriod,
				padding: s.padding,
			})),
		});
	}
	return out;
}

export async function loadClientOptions(): Promise<ClientOption[]> {
	const workspaceId = getDefaultWorkspaceId();
	const rows = await db
		.select()
		.from(clients)
		.where(eq(clients.workspaceId, workspaceId));
	const out: ClientOption[] = [];
	for (const r of rows) {
		const snap = ClientSnapshotSchema.safeParse(r.snapshot);
		if (!snap.success) {
			continue;
		}
		out.push({ id: r.id, snapshot: snap.data });
	}
	return out;
}
