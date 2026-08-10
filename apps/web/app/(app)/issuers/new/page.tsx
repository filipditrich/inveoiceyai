import { IssuerEditorForm } from "@/components/issuers/issuer-editor-form";

type Search = Promise<{ invalid?: string }>;

export default async function IssuersNewPage({
	searchParams,
}: {
	searchParams: Search;
}) {
	const sp = await searchParams;
	const uploadConfigured = Boolean(process.env.UPLOADTHING_TOKEN?.trim());

	return (
		<div className="space-y-6 px-4 py-6 lg:px-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">New issuer</h1>
				<p className="text-muted-foreground">
					Zadej IČO a Lookup (ARES), banku a číslování.
				</p>
			</div>
			<IssuerEditorForm
				invalidQuery={sp.invalid ?? null}
				mode="create"
				uploadConfigured={uploadConfigured}
			/>
		</div>
	);
}
