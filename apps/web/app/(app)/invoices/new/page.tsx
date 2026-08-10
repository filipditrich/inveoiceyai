import { InvoiceBuilderForm } from "@/components/invoices/invoice-builder-form";
import { loadClientOptions, loadIssuerOptions } from "@/lib/load-parties";

type Search = Promise<{ invalid?: string }>;

export default async function InvoiceNewPage({
	searchParams,
}: {
	searchParams: Search;
}) {
	const sp = await searchParams;
	const [issuers, clients] = await Promise.all([
		loadIssuerOptions(),
		loadClientOptions(),
	]);

	return (
		<div className="space-y-6 px-4 py-6 lg:px-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>
				<p className="text-muted-foreground">
					Draft → Issue. Náhled PDF vpravo.
				</p>
			</div>
			<InvoiceBuilderForm
				clients={clients}
				invalidQuery={sp.invalid ?? null}
				issuers={issuers}
				mode="create"
			/>
		</div>
	);
}
