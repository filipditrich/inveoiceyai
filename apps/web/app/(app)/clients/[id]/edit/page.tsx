import { deleteClient } from "@/actions/clients";
import { ClientEditorForm } from "@/components/clients/client-editor-form";
import { Button } from "@/components/ui/button";
import { getDefaultWorkspaceId } from "@/lib/workspace-id";
import { ClientSnapshotSchema } from "@invoicey/invoice-core/schema";
import { clients } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

type Search = Promise<{ invalid?: string }>;

type Params = Promise<{ id: string }>;

export default async function ClientEditPage({
	params,
	searchParams,
}: {
	params: Params;
	searchParams: Search;
}) {
	const { id } = await params;
	const workspaceId = getDefaultWorkspaceId();
	const sp = await searchParams;

	const hit = await db
		.select()
		.from(clients)
		.where(
			and(eq(clients.workspaceId, workspaceId), eq(clients.id, id)),
		)
		.limit(1);
	const row = hit[0];

	if (!row) {
		notFound();
	}

	const snap = ClientSnapshotSchema.safeParse(row.snapshot);
	if (!snap.success) {
		notFound();
	}

	return (
		<div className="space-y-6 px-4 py-6 lg:px-6">
			<div className="flex flex-wrap items-center gap-4">
				<Button render={<Link href="/clients" prefetch />} variant="outline" size="sm">
					← Back
				</Button>
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Edit client</h1>
					<p className="text-muted-foreground">{snap.data.name}</p>
				</div>
			</div>
			<ClientEditorForm invalidQuery={sp.invalid ?? null} mode="edit" snapshot={snap.data} />

			<div className="border-destructive/40 rounded-md border p-4">
				<form action={deleteClient} className="flex flex-wrap items-center gap-3">
					<input name="id" type="hidden" value={id} />
					<Button type="submit" variant="destructive">
						Delete client
					</Button>
					<span className="text-muted-foreground text-sm">Nenávratné.</span>
				</form>
			</div>
		</div>
	);
}
