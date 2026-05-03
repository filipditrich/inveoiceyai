import { ClientEditorForm } from "@/components/clients/client-editor-form";

type Search = Promise<{ invalid?: string }>;

export default async function ClientsNewPage({
	searchParams,
}: {
	searchParams: Search;
}) {
	const sp = await searchParams;

	return (
		<div className="space-y-6 px-4 py-6 lg:px-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">New client</h1>
				<p className="text-muted-foreground">
					Zadej IČO a Lookup (ARES), nebo vyplň ručně.
				</p>
			</div>
			<ClientEditorForm invalidQuery={sp.invalid ?? null} mode="create" />
		</div>
	);
}
