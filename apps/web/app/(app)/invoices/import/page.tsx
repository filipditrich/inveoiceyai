import { InvoiceImportForm } from "@/components/invoices/invoice-import-form";
import { requireWorkspace } from "@/lib/auth/session";
import { loadIssuerOptions } from "@/lib/load-parties";
import Link from "next/link";

export default async function InvoiceImportPage() {
	const { workspaceId } = await requireWorkspace();
	const issuers = await loadIssuerOptions(workspaceId);

	return (
		<div className="@container/main space-y-4 px-4 py-6 lg:px-6">
			<div className="flex flex-wrap items-end justify-between gap-2">
				<div>
					<p className="text-muted-foreground mb-1 text-sm">
						<Link className="hover:underline" href="/invoices">
							← Faktury
						</Link>
					</p>
					<h1 className="text-2xl font-semibold tracking-tight">
						Import historických faktur
					</h1>
					<p className="text-muted-foreground max-w-2xl text-sm">
						Nahrajte PDF. Pokud obsahují ISDOC (~80&nbsp;%), naparsujeme je celé.
						Bez ISDOC uložíme originál jako archiv a doplníte hlavičku ručně.
					</p>
				</div>
			</div>
			<InvoiceImportForm
				issuers={issuers.map((i) => ({
					id: i.id,
					name: i.snapshot.name,
				}))}
			/>
		</div>
	);
}
