import {
	IssuerEditorForm,
	type NumberingSchemeDraft,
} from "@/components/issuers/issuer-editor-form";
import { ensureIssuerNumberingSchemes } from "@/lib/issuer-numbering";
import { getDefaultWorkspaceId } from "@/lib/workspace-id";
import { IssuerSnapshotSchema } from "@invoicey/invoice-core/schema";
import { issuerBusinesses, issuerNumberingSchemes } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

type Search = Promise<{ invalid?: string }>;
type Params = Promise<{ id: string }>;

export default async function IssuerEditPage({
	params,
	searchParams,
}: {
	params: Params;
	searchParams: Search;
}) {
	const { id } = await params;
	const sp = await searchParams;
	const workspaceId = getDefaultWorkspaceId();
	const uploadConfigured = Boolean(process.env.UPLOADTHING_TOKEN?.trim());

	const rows = await db
		.select()
		.from(issuerBusinesses)
		.where(
			and(
				eq(issuerBusinesses.id, id),
				eq(issuerBusinesses.workspaceId, workspaceId),
			),
		)
		.limit(1);

	const row = rows[0];
	if (!row) {
		notFound();
	}

	const snapshot = IssuerSnapshotSchema.safeParse(row.snapshot);
	if (!snapshot.success) {
		notFound();
	}

	await ensureIssuerNumberingSchemes(db, { workspaceId, issuerId: id });

	const schemeRows = await db
		.select()
		.from(issuerNumberingSchemes)
		.where(eq(issuerNumberingSchemes.issuerId, id));

	const schemes: NumberingSchemeDraft[] = [];
	for (const s of schemeRows) {
		if (
			s.docType !== "invoice" &&
			s.docType !== "proforma" &&
			s.docType !== "advance" &&
			s.docType !== "credit_note"
		) {
			continue;
		}
		schemes.push({
			docType: s.docType,
			template: s.template,
			resetPeriod: s.resetPeriod === "never" ? "never" : "yearly",
			counter: s.counter,
			counterYear: s.counterYear,
			padding: s.padding,
		});
	}

	return (
		<div className="space-y-6 px-4 py-6 lg:px-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Edit issuer</h1>
				<p className="text-muted-foreground">{snapshot.data.name}</p>
			</div>
			<IssuerEditorForm
				invalidQuery={sp.invalid ?? null}
				mode="edit"
				schemes={schemes}
				snapshot={snapshot.data}
				uploadConfigured={uploadConfigured}
			/>
		</div>
	);
}
