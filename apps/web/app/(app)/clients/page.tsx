import { deleteClient } from "@/actions/clients";
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
	ClientSnapshotSchema,
	type ClientSnapshot,
} from "@invoicey/invoice-core/schema";
import { db } from "@invoicey/db";
import { clients } from "@invoicey/db";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";

type ClientTableItem = {
	rowId: string;
	source: string;
	snapshot: ClientSnapshot;
};

export default async function ClientsPage() {
	const workspaceId = getDefaultWorkspaceId();
	const rows = await db
		.select()
		.from(clients)
		.where(eq(clients.workspaceId, workspaceId))
		.orderBy(desc(clients.updatedAt));

	const items: ClientTableItem[] = [];
	for (const r of rows) {
		const parsed = ClientSnapshotSchema.safeParse(r.snapshot);
		if (!parsed.success) {
			continue;
		}
		items.push({
			rowId: r.id,
			source: r.source,
			snapshot: parsed.data,
		});
	}

	return (
		<div className="space-y-4 px-4 py-6 lg:px-6">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
					<p className="text-muted-foreground">
						Odběratelé — ARES Lookup nebo ruční záznam.
					</p>
				</div>
				<Button render={<Link href="/clients/new" prefetch />} size="sm">
					New client
				</Button>
			</div>

			{items.length === 0 ? (
				<p className="text-muted-foreground">
					Zatím žádní klienti.{" "}
					<Link className="text-primary underline-offset-4 hover:underline" href="/clients/new">
						Založ první
					</Link>
					.
				</p>
			) : (
				<div className="rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Jméno</TableHead>
								<TableHead>IČO</TableHead>
								<TableHead>Město</TableHead>
								<TableHead>Zdroj</TableHead>
								<TableHead className="text-right">Akce</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.map((item) => (
								<TableRow key={item.rowId}>
									<TableCell className="font-medium">
										{item.snapshot.name}
									</TableCell>
									<TableCell>{item.snapshot.ico ?? "—"}</TableCell>
									<TableCell>{item.snapshot.address.city}</TableCell>
									<TableCell className="capitalize">{item.source}</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-2">
											<Button
												render={<Link href={`/clients/${item.rowId}/edit`} prefetch />}
												size="sm"
												variant="outline"
											>
												Edit
											</Button>
											<form action={deleteClient}>
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
