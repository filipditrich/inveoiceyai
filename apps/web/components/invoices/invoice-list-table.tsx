"use client";

import {
	bulkCancelInvoice,
	bulkDeleteInvoice,
	bulkIssueInvoice,
	bulkMarkInvoicePaid,
	bulkUnmarkInvoicePaid,
	cancelInvoice,
	deleteInvoice,
	duplicateInvoice,
	issueSavedInvoice,
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
import { formatDateCs, formatMoney } from "@/lib/format";
import { DISPLAY_STATUS_ROW_ACCENT } from "@/lib/invoice-status-ui";
import { cn } from "@/lib/utils";
import type { InvoiceDisplayStatus } from "@invoicey/invoice-core/status-display";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

export type InvoiceListRow = {
	id: string;
	number: string | null;
	issueDate: string;
	dueDate: string;
	clientName: string;
	total: string;
	currency: string;
	displayStatus: InvoiceDisplayStatus;
	importCompleteness?: string | null;
	originProvider?: string | null;
};

export function InvoiceListTable({ rows }: { rows: InvoiceListRow[] }) {
	const [selected, setSelected] = useState<Set<string>>(() => new Set());
	const [pending, startTransition] = useTransition();
	const ids = rows.map((r) => r.id);
	const allSelected = ids.length > 0 && selected.size === ids.length;

	const selectedRows = useMemo(
		() => rows.filter((r) => selected.has(r.id)),
		[rows, selected],
	);
	const selectedTotal = selectedRows.reduce(
		(sum, r) => sum + (Number(r.total) || 0),
		0,
	);
	const selectedDrafts = selectedRows.filter(
		(r) => r.displayStatus === "draft",
	).length;

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

	const barVisible = selected.size > 0;

	return (
		<div className={cn("space-y-3", barVisible && "pb-24")}>
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
									{row.importCompleteness === "archive" ? (
										<span className="text-muted-foreground ml-2 text-[0.65rem] uppercase tracking-wide">
											archiv
										</span>
									) : null}
									{row.originProvider ? (
										<span className="text-muted-foreground ml-2 text-[0.65rem]">
											· {row.originProvider}
										</span>
									) : null}
								</TableCell>
								<TableCell className="tabular-nums">
									{formatDateCs(row.issueDate)}
								</TableCell>
								<TableCell className="tabular-nums">
									{formatDateCs(row.dueDate)}
								</TableCell>
								<TableCell>{row.clientName}</TableCell>
								<TableCell className="tabular-nums">
									{formatMoney(Number(row.total) || 0, row.currency || "CZK")}
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
											Detail
										</Button>
										{row.displayStatus === "draft" ? (
											<>
												<form action={issueSavedInvoice}>
													<input name="id" type="hidden" value={row.id} />
													<Button size="sm" type="submit">
														Vystavit
													</Button>
												</form>
												<Button
													render={
														<Link href={`/invoices/${row.id}/edit`} prefetch />
													}
													size="sm"
													variant="outline"
												>
													Upravit
												</Button>
											</>
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
														Zaplaceno
													</Button>
												</form>
												<form action={cancelInvoice}>
													<input name="id" type="hidden" value={row.id} />
													<Button size="sm" type="submit" variant="ghost">
														Storno
													</Button>
												</form>
											</>
										) : null}
										{row.displayStatus === "paid" ? (
											<form action={unmarkInvoicePaid}>
												<input name="id" type="hidden" value={row.id} />
												<Button size="sm" type="submit" variant="ghost">
													Zrušit zapl.
												</Button>
											</form>
										) : null}
										{row.displayStatus === "draft" ? (
											<form action={deleteInvoice}>
												<input name="id" type="hidden" value={row.id} />
												<Button size="sm" type="submit" variant="destructive">
													Smazat
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

			{barVisible ? (
				<div className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3 shadow-lg backdrop-blur">
					<div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
						<div className="min-w-0 flex-1 text-sm">
							<span className="font-medium tabular-nums">
								{selected.size} vybraných
							</span>
							<span className="text-muted-foreground">
								{" "}
								· {formatMoney(selectedTotal)}
								{selectedDrafts > 0
									? ` · ${selectedDrafts} draft${selectedDrafts === 1 ? "" : "y"}`
									: null}
							</span>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button
								disabled={pending || selectedDrafts === 0}
								onClick={() => runBulk(bulkIssueInvoice)}
								size="sm"
								type="button"
							>
								Vystavit
							</Button>
							<Button
								disabled={pending}
								onClick={() => runBulk(bulkMarkInvoicePaid)}
								size="sm"
								type="button"
								variant="secondary"
							>
								Zaplaceno
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
							<Button
								disabled={pending}
								onClick={() => setSelected(new Set())}
								size="sm"
								type="button"
								variant="ghost"
							>
								Zrušit výběr
							</Button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
