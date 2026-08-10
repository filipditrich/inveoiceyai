import { deleteIssuer } from "@/actions/issuers";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { getDefaultWorkspaceId } from "@/lib/workspace-id";
import {
	IssuerSnapshotSchema,
	type IssuerSnapshot,
} from "@invoicey/invoice-core/schema";
import { issuerBusinesses } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";

type IssuerTableItem = {
	rowId: string;
	source: string;
	snapshot: IssuerSnapshot;
};

type Search = Promise<{ invalid?: string }>;

export default async function IssuersPage({
	searchParams,
}: {
	searchParams: Search;
}) {
	const sp = await searchParams;
	const workspaceId = getDefaultWorkspaceId();
	const rows = await db
		.select()
		.from(issuerBusinesses)
		.where(eq(issuerBusinesses.workspaceId, workspaceId))
		.orderBy(desc(issuerBusinesses.updatedAt));

	const items: IssuerTableItem[] = [];
	for (const r of rows) {
		const parsed = IssuerSnapshotSchema.safeParse(r.snapshot);
		if (!parsed.success) {
			continue;
		}
		items.push({
			rowId: r.id,
			source: r.source,
			snapshot: parsed.data,
		});
	}

	const err =
		sp.invalid === "has_invoices"
			? "Nelze smazat vystavovatele s existujícími fakturami."
			: sp.invalid
				? `Chyba: ${sp.invalid}`
				: null;

	return (
		<div className="space-y-4 px-4 py-6 lg:px-6">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Issuers</h1>
					<p className="text-muted-foreground">
						Vystavovatelé — ARES, banka, DPH, číslování, logo.
					</p>
				</div>
				<Button render={<Link href="/issuers/new" prefetch />} size="sm">
					New issuer
				</Button>
			</div>

			{err ? <p className="text-destructive text-sm">{err}</p> : null}

			{items.length === 0 ? (
				<p className="text-muted-foreground">
					Zatím žádní vystavovatelé.{" "}
					<Link
						className="text-primary underline-offset-4 hover:underline"
						href="/issuers/new"
					>
						Založ první
					</Link>
					.
				</p>
			) : (
				<div className="rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Název</TableHead>
								<TableHead>IČO</TableHead>
								<TableHead>DIČ</TableHead>
								<TableHead>DPH</TableHead>
								<TableHead className="text-right">Akce</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.map((item) => (
								<TableRow key={item.rowId}>
									<TableCell className="font-medium">
										{item.snapshot.name}
									</TableCell>
									<TableCell>{item.snapshot.ico}</TableCell>
									<TableCell>{item.snapshot.dic ?? "—"}</TableCell>
									<TableCell>
										{item.snapshot.vatPayer ? "Plátce" : "Neplátce"}
									</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-2">
											<Button
												render={
													<Link href={`/issuers/${item.rowId}/edit`} prefetch />
												}
												size="sm"
												variant="outline"
											>
												Edit
											</Button>
											<form action={deleteIssuer}>
												<input name="id" type="hidden" value={item.rowId} />
												<Button size="sm" type="submit" variant="destructive">
													Delete
												</Button>
											</form>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}
