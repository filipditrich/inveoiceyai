"use client";

import {
	bulkCancelInvoice,
	bulkDeleteInvoice,
	bulkMarkInvoicePaid,
	bulkUnmarkInvoicePaid,
	cancelInvoice,
	deleteInvoice,
	duplicateInvoice,
	markInvoicePaid,
	unmarkInvoicePaid,
} from "@/actions/invoices";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { DISPLAY_STATUS_ROW_ACCENT } from "@/lib/invoice-status-ui";
import { cn } from "@/lib/utils";
import type { InvoiceDisplayStatus } from "@invoicey/invoice-core/status-display";
import Link from "next/link";
import { useState, useTransition } from "react";

export type InvoiceListRow = {
	id: string;
	number: string | null;
	issueDate: string;
	dueDate: string;
	clientName: string;
	total: string;
	currency: string;
	displayStatus: InvoiceDisplayStatus;
};

export function InvoiceListTable({ rows }: { rows: InvoiceListRow[] }) {
	const [selected, setSelected] = useState<Set<string>>(() => new Set());
	const [pending, startTransition] = useTransition();
	const ids = rows.map((r) => r.id);
	const allSelected = ids.length > 0 && selected.size === ids.length;

	const toggle = (id: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const toggleAll = () => {
		setSelected((prev) =>
			prev.size === ids.length ? new Set() : new Set(ids),
		);
	};

	const runBulk = (action: (fd: FormData) => Promise<void>) => {
		const fd = new FormData();
		for (const id of selected) {
			fd.append("ids", id);
		}
		startTransition(async () => {
			await action(fd);
		});
	};

	return (
		<div className="space-y-3">
			{selected.size > 0 ? (
				<div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
					<span className="tabular-nums">{selected.size} vybraných</span>
					<Button
						disabled={pending}
						onClick={() => runBulk(bulkMarkInvoicePaid)}
						size="sm"
						type="button"
						variant="secondary"
					>
						Označit zaplaceno
					</Button>
					<Button
						disabled={pending}
						onClick={() => runBulk(bulkUnmarkInvoicePaid)}
						size="sm"
						type="button"
						variant="secondary"
					>
						Zrušit zaplaceno
					</Button>
					<Button
						disabled={pending}
						onClick={() => runBulk(bulkCancelInvoice)}
						size="sm"
						type="button"
						variant="secondary"
					>
						Stornovat
					</Button>
					<Button
						disabled={pending}
						onClick={() => runBulk(bulkDeleteInvoice)}
						size="sm"
						type="button"
						variant="destructive"
					>
						Smazat návrhy
					</Button>
				</div>
			) : null}
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-10">
								<Checkbox
									aria-label="Vybrat vše"
									checked={allSelected}
									onCheckedChange={() => toggleAll()}
								/>
							</TableHead>
							<TableHead>Číslo</TableHead>
							<TableHead>Vystaveno</TableHead>
							<TableHead>Splatnost</TableHead>
							<TableHead>Klient</TableHead>
							<TableHead>Celkem</TableHead>
							<TableHead>Stav</TableHead>
							<TableHead className="text-right">Akce</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<TableRow
								className={cn(DISPLAY_STATUS_ROW_ACCENT[row.displayStatus])}
								key={row.id}
							>
								<TableCell>
									<Checkbox
										aria-label={`Vybrat ${row.number ?? row.id}`}
										checked={selected.has(row.id)}
										onCheckedChange={() => toggle(row.id)}
									/>
								</TableCell>
								<TableCell className="font-medium tabular-nums">
									<Link
										className="underline-offset-4 hover:underline"
										href={`/invoices/${row.id}`}
									>
										{row.number ?? "DRAFT"}
									</Link>
								</TableCell>
								<TableCell>{row.issueDate}</TableCell>
								<TableCell>{row.dueDate}</TableCell>
								<TableCell>{row.clientName}</TableCell>
								<TableCell className="tabular-nums">
									{Number(row.total).toFixed(2)} {row.currency}
								</TableCell>
								<TableCell>
									<InvoiceStatusBadge status={row.displayStatus} />
								</TableCell>
								<TableCell className="text-right">
									<div className="flex flex-wrap justify-end gap-1">
										<Button
											render={<Link href={`/invoices/${row.id}`} prefetch />}
											size="sm"
											variant="ghost"
										>
											View
										</Button>
										{row.displayStatus === "draft" ? (
											<Button
												render={
													<Link href={`/invoices/${row.id}/edit`} prefetch />
												}
												size="sm"
												variant="outline"
											>
												Edit
											</Button>
										) : null}
										<Button
											render={
												<a download href={`/api/invoices/${row.id}/pdf`} />
											}
											size="sm"
											variant="ghost"
										>
											PDF
										</Button>
										<form action={duplicateInvoice}>
											<input name="id" type="hidden" value={row.id} />
											<Button size="sm" type="submit" variant="ghost">
												Dup
											</Button>
										</form>
										{row.displayStatus === "unpaid" ||
										row.displayStatus === "overdue" ||
										row.displayStatus === "future" ? (
											<>
												<form action={markInvoicePaid}>
													<input name="id" type="hidden" value={row.id} />
													<Button size="sm" type="submit" variant="ghost">
														Paid
													</Button>
												</form>
												<form action={cancelInvoice}>
													<input name="id" type="hidden" value={row.id} />
													<Button size="sm" type="submit" variant="ghost">
														Cancel
													</Button>
												</form>
											</>
										) : null}
										{row.displayStatus === "paid" ? (
											<form action={unmarkInvoicePaid}>
												<input name="id" type="hidden" value={row.id} />
												<Button size="sm" type="submit" variant="ghost">
													Unmark
												</Button>
											</form>
										) : null}
										{row.displayStatus === "draft" ? (
											<form action={deleteInvoice}>
												<input name="id" type="hidden" value={row.id} />
												<Button size="sm" type="submit" variant="destructive">
													Del
												</Button>
											</form>
										) : null}
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
