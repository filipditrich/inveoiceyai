import {
	cancelInvoice,
	deleteInvoice,
	duplicateInvoice,
	markInvoicePaid,
} from "@/actions/invoices";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { pragueTodayIso, statusWhere } from "@/lib/invoice-status-sql";
import { loadClientOptions, loadIssuerOptions } from "@/lib/load-parties";
import {
	ensureDefaultWorkspace,
	getDefaultWorkspaceId,
} from "@/lib/workspace-id";
import { deriveStatus, type InvoiceStatus } from "@invoicey/invoice-core/status";
import { invoices } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	ilike,
	lte,
	or,
} from "drizzle-orm";
import Link from "next/link";
import type { ReactNode } from "react";

const PAGE_SIZE = 50;

type Search = Promise<{
	invalid?: string;
	status?: string;
	issuerId?: string;
	clientId?: string;
	q?: string;
	from?: string;
	to?: string;
	page?: string;
	sort?: string;
}>;

const STATUS_VALUES: InvoiceStatus[] = [
	"draft",
	"issued",
	"overdue",
	"paid",
	"cancelled",
];

const STATUS_LABELS: Record<InvoiceStatus, string> = {
	draft: "Draft",
	issued: "Issued",
	overdue: "Overdue",
	paid: "Paid",
	cancelled: "Cancelled",
};

function recordsLabel(n: number): string {
	return n === 1 ? "1 record" : `${n} records`;
}

export default async function InvoicesPage({
	searchParams,
}: {
	searchParams: Search;
}) {
	await ensureDefaultWorkspace();
	const sp = await searchParams;
	const workspaceId = getDefaultWorkspaceId();
	const page = Math.max(1, Number(sp.page ?? "1") || 1);
	const sort = sp.sort === "date_asc" ? "date_asc" : "date_desc";
	const todayIso = pragueTodayIso();

	const conditions = [eq(invoices.workspaceId, workspaceId)];
	if (sp.issuerId) {
		conditions.push(eq(invoices.issuerId, sp.issuerId));
	}
	if (sp.clientId) {
		conditions.push(eq(invoices.clientId, sp.clientId));
	}
	if (sp.from) {
		conditions.push(gte(invoices.issueDate, sp.from));
	}
	if (sp.to) {
		conditions.push(lte(invoices.issueDate, sp.to));
	}
	if (sp.q?.trim()) {
		const q = `%${sp.q.trim()}%`;
		conditions.push(
			or(
				ilike(invoices.number, q),
				ilike(invoices.clientName, q),
				ilike(invoices.notes, q),
			)!,
		);
	}

	const statusFilter =
		sp.status && STATUS_VALUES.includes(sp.status as InvoiceStatus)
			? (sp.status as InvoiceStatus)
			: null;
	if (statusFilter) {
		const pred = statusWhere(statusFilter, todayIso);
		if (pred) {
			conditions.push(pred);
		}
	}

	const whereClause = and(...conditions);

	const [totalRow] = await db
		.select({ value: count() })
		.from(invoices)
		.where(whereClause);
	const total = Number(totalRow?.value ?? 0);
	const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const safePage = Math.min(page, pageCount);
	const offset = (safePage - 1) * PAGE_SIZE;

	const rows = await db
		.select()
		.from(invoices)
		.where(whereClause)
		.orderBy(
			sort === "date_asc" ? asc(invoices.issueDate) : desc(invoices.issueDate),
			desc(invoices.createdAt),
		)
		.limit(PAGE_SIZE)
		.offset(offset);

	const now = new Date();
	const pageItems = rows.map((row) => ({
		row,
		status: deriveStatus(
			{
				issuedAt: row.issuedAt,
				dueDate: new Date(`${row.dueDate}T12:00:00.000Z`),
				paidAt: row.paidAt,
				cancelledAt: row.cancelledAt,
			},
			now,
		),
	}));

	const [issuers, clients] = await Promise.all([
		loadIssuerOptions(),
		loadClientOptions(),
	]);

	return (
		<div className="space-y-4 px-4 py-6 lg:px-6">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
					<p className="text-muted-foreground">
						Filter, PDF / ISDOC, and status actions.
					</p>
				</div>
				<div className="flex gap-2">
					<Button render={<Link href="/invoices/new" prefetch />} size="sm">
						New invoice
					</Button>
					<Button
						render={<Link href="/invoices/from-json" prefetch />}
						size="sm"
						variant="outline"
					>
						From JSON
					</Button>
				</div>
			</div>

			{sp.invalid ? (
				<p className="text-destructive text-sm">Chyba: {sp.invalid}</p>
			) : null}

			<form className="flex flex-wrap items-end gap-3 rounded-md border p-3">
				<FilterField label="Status" name="status" defaultValue={sp.status}>
					<option value="">All</option>
					{STATUS_VALUES.map((s) => (
						<option key={s} value={s}>
							{STATUS_LABELS[s]}
						</option>
					))}
				</FilterField>
				<FilterField
					label="Issuer"
					name="issuerId"
					defaultValue={sp.issuerId}
				>
					<option value="">All</option>
					{issuers.map((i) => (
						<option key={i.id} value={i.id}>
							{i.snapshot.name}
						</option>
					))}
				</FilterField>
				<FilterField
					label="Client"
					name="clientId"
					defaultValue={sp.clientId}
				>
					<option value="">All</option>
					{clients.map((c) => (
						<option key={c.id} value={c.id}>
							{c.snapshot.name}
						</option>
					))}
				</FilterField>
				<label className="space-y-1 text-xs">
					<span className="text-muted-foreground">From</span>
					<input
						className="border-input bg-background block h-9 rounded-md border px-2 text-sm"
						defaultValue={sp.from ?? ""}
						name="from"
						type="date"
					/>
				</label>
				<label className="space-y-1 text-xs">
					<span className="text-muted-foreground">To</span>
					<input
						className="border-input bg-background block h-9 rounded-md border px-2 text-sm"
						defaultValue={sp.to ?? ""}
						name="to"
						type="date"
					/>
				</label>
				<label className="space-y-1 text-xs">
					<span className="text-muted-foreground">Search</span>
					<input
						className="border-input bg-background block h-9 rounded-md border px-2 text-sm"
						defaultValue={sp.q ?? ""}
						name="q"
						placeholder="number, client…"
					/>
				</label>
				<label className="space-y-1 text-xs">
					<span className="text-muted-foreground">Sort</span>
					<select
						className="border-input bg-background block h-9 rounded-md border px-2 text-sm"
						defaultValue={sort}
						name="sort"
					>
						<option value="date_desc">Date ↓</option>
						<option value="date_asc">Date ↑</option>
					</select>
				</label>
				<Button size="sm" type="submit" variant="secondary">
					Filter
				</Button>
			</form>

			{pageItems.length === 0 ? (
				<p className="text-muted-foreground">
					No invoices yet.{" "}
					<Link
						className="text-primary underline-offset-4 hover:underline"
						href="/invoices/new"
					>
						Create your first invoice
					</Link>
					.
				</p>
			) : (
				<div className="rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
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
							{pageItems.map(({ row, status }) => (
								<TableRow key={row.id}>
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
										<span className="bg-muted rounded px-2 py-0.5 text-xs capitalize">
											{status}
										</span>
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
											{status === "draft" ? (
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
													<a href={`/api/invoices/${row.id}/pdf`} download />
												}
												size="sm"
												variant="ghost"
											>
												PDF
											</Button>
											<Button
												render={
													<a href={`/api/invoices/${row.id}/isdoc`} download />
												}
												size="sm"
												variant="ghost"
											>
												ISDOC
											</Button>
											<form action={duplicateInvoice}>
												<input name="id" type="hidden" value={row.id} />
												<Button size="sm" type="submit" variant="ghost">
													Dup
												</Button>
											</form>
											{status === "issued" || status === "overdue" ? (
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
											{status === "draft" ? (
												<form action={deleteInvoice}>
													<input name="id" type="hidden" value={row.id} />
													<Button
														size="sm"
														type="submit"
														variant="destructive"
													>
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
			)}

			{pageCount > 1 || total > 0 ? (
				<p className="text-muted-foreground text-sm">
					Page {safePage} / {pageCount} ({recordsLabel(total)})
					{safePage > 1 ? (
						<>
							{" "}
							·{" "}
							<Link className="underline" href={withPage(sp, safePage - 1)}>
								prev
							</Link>
						</>
					) : null}
					{safePage < pageCount ? (
						<>
							{" "}
							·{" "}
							<Link className="underline" href={withPage(sp, safePage + 1)}>
								next
							</Link>
						</>
					) : null}
				</p>
			) : null}
		</div>
	);
}

function FilterField(props: {
	label: string;
	name: string;
	defaultValue?: string;
	children: ReactNode;
}) {
	return (
		<label className="space-y-1 text-xs">
			<span className="text-muted-foreground">{props.label}</span>
			<select
				className="border-input bg-background block h-9 min-w-[8rem] rounded-md border px-2 text-sm"
				defaultValue={props.defaultValue ?? ""}
				name={props.name}
			>
				{props.children}
			</select>
		</label>
	);
}

function withPage(
	sp: {
		status?: string;
		issuerId?: string;
		clientId?: string;
		q?: string;
		from?: string;
		to?: string;
		sort?: string;
	},
	page: number,
): string {
	const params = new URLSearchParams();
	if (sp.status) {
		params.set("status", sp.status);
	}
	if (sp.issuerId) {
		params.set("issuerId", sp.issuerId);
	}
	if (sp.clientId) {
		params.set("clientId", sp.clientId);
	}
	if (sp.q) {
		params.set("q", sp.q);
	}
	if (sp.from) {
		params.set("from", sp.from);
	}
	if (sp.to) {
		params.set("to", sp.to);
	}
	if (sp.sort) {
		params.set("sort", sp.sort);
	}
	params.set("page", String(page));
	return `/invoices?${params.toString()}`;
}
