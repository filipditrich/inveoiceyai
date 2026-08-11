import { InvoiceListTable } from "@/components/invoices/invoice-list-table";
import { InvoiceStatusSummary } from "@/components/invoices/invoice-status-summary";
import { Button } from "@/components/ui/button";
import {
	displayStatusWhere,
	pragueTodayIso,
} from "@/lib/invoice-status-sql";
import { loadClientOptions, loadIssuerOptions } from "@/lib/load-parties";
import { requireWorkspace } from "@/lib/auth/session";
import {
	DISPLAY_STATUS_LABELS,
	INVOICE_DISPLAY_STATUSES,
	normalizeDisplayStatusParam,
	resolveDisplayStatus,
	type InvoiceDisplayStatus,
} from "@invoicey/invoice-core/status-display";
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
	type SQL,
} from "drizzle-orm";
import Link from "next/link";
import type { ReactNode } from "react";

const PAGE_SIZE = 50;

type Search = Promise<{
	invalid?: string;
	toast?: string;
	ok?: string;
	skipped?: string;
	failed?: string;
	status?: string;
	issuerId?: string;
	clientId?: string;
	q?: string;
	from?: string;
	to?: string;
	page?: string;
	sort?: string;
}>;

function recordsLabel(n: number): string {
	return n === 1 ? "1 záznam" : `${n} záznamů`;
}

function buildBaseConditions(
	workspaceId: string,
	sp: {
		issuerId?: string;
		clientId?: string;
		q?: string;
		from?: string;
		to?: string;
	},
): SQL[] {
	const conditions: SQL[] = [eq(invoices.workspaceId, workspaceId)];
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
	return conditions;
}

export default async function InvoicesPage({
	searchParams,
}: {
	searchParams: Search;
}) {
	const sp = await searchParams;
	const { workspaceId } = await requireWorkspace();
	const page = Math.max(1, Number(sp.page ?? "1") || 1);
	const sort = sp.sort === "date_asc" ? "date_asc" : "date_desc";
	const todayIso = pragueTodayIso();
	const statusFilter = normalizeDisplayStatusParam(sp.status);

	const baseConditions = buildBaseConditions(workspaceId, sp);
	const listConditions = [...baseConditions];
	if (statusFilter) {
		const pred = displayStatusWhere(statusFilter, todayIso);
		if (pred) {
			listConditions.push(pred);
		}
	}

	const whereClause = and(...listConditions);
	const summaryWhere = and(...baseConditions);

	const [totalRow] = await db
		.select({ value: count() })
		.from(invoices)
		.where(whereClause);
	const total = Number(totalRow?.value ?? 0);
	const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const safePage = Math.min(page, pageCount);
	const offset = (safePage - 1) * PAGE_SIZE;

	const [rows, summaryRows, issuers, clients] = await Promise.all([
		db
			.select()
			.from(invoices)
			.where(whereClause)
			.orderBy(
				sort === "date_asc" ? asc(invoices.issueDate) : desc(invoices.issueDate),
				desc(invoices.createdAt),
			)
			.limit(PAGE_SIZE)
			.offset(offset),
		db.select().from(invoices).where(summaryWhere),
		loadIssuerOptions(workspaceId),
		loadClientOptions(workspaceId),
	]);

	const tally: Record<
		InvoiceDisplayStatus,
		{ count: number; total: number }
	> = {
		draft: { count: 0, total: 0 },
		unpaid: { count: 0, total: 0 },
		overdue: { count: 0, total: 0 },
		paid: { count: 0, total: 0 },
		future: { count: 0, total: 0 },
		cancelled: { count: 0, total: 0 },
	};
	for (const row of summaryRows) {
		const display = resolveDisplayStatus(
			{
				issuedAt: row.issuedAt,
				dueDate: row.dueDate,
				paidAt: row.paidAt,
				cancelledAt: row.cancelledAt,
				issueDate: row.issueDate,
			},
			todayIso,
		);
		tally[display].count += 1;
		tally[display].total += Number(row.total) || 0;
	}
	const summaryBuckets = INVOICE_DISPLAY_STATUSES.map((status) => ({
		status,
		count: tally[status].count,
		total: tally[status].total,
	}));

	const pageItems = rows.map((row) => ({
		id: row.id,
		number: row.number,
		issueDate: row.issueDate,
		dueDate: row.dueDate,
		clientName: row.clientName,
		total: String(row.total),
		currency: row.currency,
		displayStatus: resolveDisplayStatus(
			{
				issuedAt: row.issuedAt,
				dueDate: row.dueDate,
				paidAt: row.paidAt,
				cancelledAt: row.cancelledAt,
				issueDate: row.issueDate,
			},
			todayIso,
		),
	}));

	const filterBase = {
		issuerId: sp.issuerId,
		clientId: sp.clientId,
		q: sp.q,
		from: sp.from,
		to: sp.to,
		sort: sp.sort,
	};

	return (
		<div className="@container/main space-y-4 px-4 py-6 lg:px-6">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">
						Vystavené faktury
					</h1>
					<p className="text-muted-foreground">
						Stavy, filtry a akce nad fakturami.
					</p>
				</div>
				<div className="flex gap-2">
					<Button render={<Link href="/invoices/new" prefetch />} size="sm">
						+ Vystavit fakturu
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
			{sp.toast?.startsWith("bulk_") ? (
				<p className="text-muted-foreground text-sm">
					Hromadná akce: {sp.ok ?? "0"} ok, {sp.skipped ?? "0"} přeskočeno,{" "}
					{sp.failed ?? "0"} chyb.
				</p>
			) : null}

			<InvoiceStatusSummary
				activeStatus={statusFilter}
				buckets={summaryBuckets}
				filterBase={filterBase}
			/>

			<form className="flex flex-wrap items-end gap-3 rounded-md border p-3">
				<FilterField
					defaultValue={statusFilter ?? ""}
					label="Stav"
					name="status"
				>
					<option value="">Vše</option>
					{INVOICE_DISPLAY_STATUSES.map((s) => (
						<option key={s} value={s}>
							{DISPLAY_STATUS_LABELS[s]}
						</option>
					))}
				</FilterField>
				<FilterField
					defaultValue={sp.issuerId}
					label="Dodavatel"
					name="issuerId"
				>
					<option value="">Vše</option>
					{issuers.map((i) => (
						<option key={i.id} value={i.id}>
							{i.snapshot.name}
						</option>
					))}
				</FilterField>
				<FilterField
					defaultValue={sp.clientId}
					label="Odběratel"
					name="clientId"
				>
					<option value="">Vše</option>
					{clients.map((c) => (
						<option key={c.id} value={c.id}>
							{c.snapshot.name}
						</option>
					))}
				</FilterField>
				<label className="space-y-1 text-xs">
					<span className="text-muted-foreground">Od</span>
					<input
						className="border-input bg-background block h-9 rounded-md border px-2 text-sm"
						defaultValue={sp.from ?? ""}
						name="from"
						type="date"
					/>
				</label>
				<label className="space-y-1 text-xs">
					<span className="text-muted-foreground">Do</span>
					<input
						className="border-input bg-background block h-9 rounded-md border px-2 text-sm"
						defaultValue={sp.to ?? ""}
						name="to"
						type="date"
					/>
				</label>
				<label className="space-y-1 text-xs">
					<span className="text-muted-foreground">Hledat</span>
					<input
						className="border-input bg-background block h-9 rounded-md border px-2 text-sm"
						defaultValue={sp.q ?? ""}
						name="q"
						placeholder="číslo, klient…"
					/>
				</label>
				<label className="space-y-1 text-xs">
					<span className="text-muted-foreground">Řazení</span>
					<select
						className="border-input bg-background block h-9 rounded-md border px-2 text-sm"
						defaultValue={sort}
						name="sort"
					>
						<option value="date_desc">Datum ↓</option>
						<option value="date_asc">Datum ↑</option>
					</select>
				</label>
				<Button size="sm" type="submit" variant="secondary">
					Filtrovat
				</Button>
			</form>

			{pageItems.length === 0 ? (
				<p className="text-muted-foreground">
					Žádné faktury.{" "}
					<Link
						className="text-primary underline-offset-4 hover:underline"
						href="/invoices/new"
					>
						Vytvořit první fakturu
					</Link>
					.
				</p>
			) : (
				<InvoiceListTable rows={pageItems} />
			)}

			{pageCount > 1 || total > 0 ? (
				<p className="text-muted-foreground text-sm">
					Strana {safePage} / {pageCount} ({recordsLabel(total)})
					{safePage > 1 ? (
						<>
							{" "}
							·{" "}
							<Link className="underline" href={withPage(sp, safePage - 1)}>
								předchozí
							</Link>
						</>
					) : null}
					{safePage < pageCount ? (
						<>
							{" "}
							·{" "}
							<Link className="underline" href={withPage(sp, safePage + 1)}>
								další
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
				className="border-input bg-background block h-9 min-w-32 rounded-md border px-2 text-sm"
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
	const status = normalizeDisplayStatusParam(sp.status);
	if (status) {
		params.set("status", status);
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
