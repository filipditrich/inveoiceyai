import {
	cancelInvoice,
	deleteInvoice,
	duplicateInvoice,
	markInvoicePaid,
} from "@/actions/invoices";
import { Button } from "@/components/ui/button";
import { getDefaultWorkspaceId } from "@/lib/workspace-id";
import { InvoiceSchema } from "@invoicey/invoice-core/schema";
import { deriveStatus } from "@invoicey/invoice-core/status";
import { db, invoices } from "@invoicey/db";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

type Params = Promise<{ id: string }>;
type Search = Promise<{ invalid?: string }>;

export default async function InvoiceDetailPage({
	params,
	searchParams,
}: {
	params: Params;
	searchParams: Search;
}) {
	const { id } = await params;
	const sp = await searchParams;
	const workspaceId = getDefaultWorkspaceId();
	const rows = await db
		.select()
		.from(invoices)
		.where(and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)))
		.limit(1);
	const row = rows[0];
	if (!row) {
		notFound();
	}

	const payload = InvoiceSchema.safeParse(row.payloadJson);
	const status = deriveStatus(
		{
			issuedAt: row.issuedAt,
			dueDate: new Date(`${row.dueDate}T12:00:00.000Z`),
			paidAt: row.paidAt,
			cancelledAt: row.cancelledAt,
		},
		new Date(),
	);

	return (
		<div className="space-y-6 px-4 py-6 lg:px-6">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight tabular-nums">
						{row.number ?? "DRAFT"}
					</h1>
					<p className="text-muted-foreground">
						{row.clientName} ·{" "}
						<span className="capitalize">{status}</span>
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					{status === "draft" ? (
						<Button
							render={<Link href={`/invoices/${id}/edit`} prefetch />}
							size="sm"
						>
							Edit
						</Button>
					) : null}
					<Button
						render={<a href={`/api/invoices/${id}/pdf`} download />}
						size="sm"
						variant="outline"
					>
						Download PDF
					</Button>
					<Button
						render={<a href={`/api/invoices/${id}/isdoc`} download />}
						size="sm"
						variant="outline"
					>
						Download ISDOC
					</Button>
					<form action={duplicateInvoice}>
						<input name="id" type="hidden" value={id} />
						<Button size="sm" type="submit" variant="secondary">
							Duplicate
						</Button>
					</form>
					{status === "issued" || status === "overdue" ? (
						<>
							<form action={markInvoicePaid}>
								<input name="id" type="hidden" value={id} />
								<Button size="sm" type="submit">
									Mark paid
								</Button>
							</form>
							<form action={cancelInvoice}>
								<input name="id" type="hidden" value={id} />
								<Button size="sm" type="submit" variant="secondary">
									Cancel
								</Button>
							</form>
						</>
					) : null}
					{status === "draft" ? (
						<form action={deleteInvoice}>
							<input name="id" type="hidden" value={id} />
							<Button size="sm" type="submit" variant="destructive">
								Delete
							</Button>
						</form>
					) : null}
				</div>
			</div>

			{sp.invalid ? (
				<p className="text-destructive text-sm">Chyba: {sp.invalid}</p>
			) : null}

			<dl className="grid gap-3 text-sm sm:grid-cols-2">
				<div>
					<dt className="text-muted-foreground">Datum vystavení</dt>
					<dd>{row.issueDate}</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Splatnost</dt>
					<dd>{row.dueDate}</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">DUZP</dt>
					<dd>{row.duzp ?? "—"}</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Celkem</dt>
					<dd className="tabular-nums">
						{Number(row.total).toFixed(2)} {row.currency}
					</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Vystaveno (timestamp)</dt>
					<dd>{row.issuedAt?.toISOString() ?? "—"}</dd>
				</div>
				<div>
					<dt className="text-muted-foreground">Zaplaceno</dt>
					<dd>{row.paidAt?.toISOString() ?? "—"}</dd>
				</div>
			</dl>

			{payload.success ? (
				<div className="rounded-md border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b text-left">
								<th className="p-2">#</th>
								<th className="p-2">Popis</th>
								<th className="p-2">Množství</th>
								<th className="p-2">Cena</th>
								<th className="p-2">Celkem</th>
							</tr>
						</thead>
						<tbody>
							{payload.data.items.map((it) => (
								<tr className="border-b" key={it.position}>
									<td className="p-2">{it.position}</td>
									<td className="p-2">{it.description}</td>
									<td className="p-2 tabular-nums">
										{it.quantity} {it.unit}
									</td>
									<td className="p-2 tabular-nums">
										{it.unitPriceWithoutVat.toFixed(2)}
									</td>
									<td className="p-2 tabular-nums">
										{it.lineTotal.toFixed(2)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<p className="text-destructive text-sm">Neplatný payload v DB.</p>
			)}

			<p>
				<Link className="text-sm underline" href="/invoices">
					← Zpět na seznam
				</Link>
			</p>
		</div>
	);
}
