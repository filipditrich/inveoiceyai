"use client";

import {
	classifyImportPdfs,
	commitInvoiceImport,
	type ClassifiedImportFile,
	type CommitImportItem,
} from "@/actions/import-invoices";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { UploadDropzone } from "@/lib/uploadthing";
import {
	ORIGIN_PROVIDER_LABELS,
	buildExternalKey,
	type InvoiceOriginProvider,
} from "@invoicey/invoice-core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type IssuerOption = { id: string; name: string };

const PROVIDERS = Object.keys(ORIGIN_PROVIDER_LABELS) as InvoiceOriginProvider[];

function archiveReady(row: ClassifiedImportFile): boolean {
	if (row.status === "ready_full" && row.invoice) {
		return true;
	}
	if (row.status !== "needs_archive_fields" || !row.archive) {
		return false;
	}
	const a = row.archive;
	return Boolean(
		a.meta.number.trim() &&
			a.meta.issueDate &&
			a.meta.dueDate &&
			a.client.name.trim() &&
			Number.isFinite(a.totals.total),
	);
}

export function InvoiceImportForm({ issuers }: { issuers: IssuerOption[] }) {
	const router = useRouter();
	const [issuerId, setIssuerId] = useState(issuers[0]?.id ?? "");
	const [originProvider, setOriginProvider] =
		useState<InvoiceOriginProvider>("custom");
	const [originLabel, setOriginLabel] = useState("");
	const [originVersion, setOriginVersion] = useState("");
	const [defaultPaid, setDefaultPaid] = useState(false);
	const [rows, setRows] = useState<ClassifiedImportFile[]>([]);
	const [message, setMessage] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();

	const readyCount = useMemo(
		() => rows.filter((r) => archiveReady(r)).length,
		[rows],
	);

	const updateRow = (index: number, patch: Partial<ClassifiedImportFile>) => {
		setRows((prev) =>
			prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
		);
	};

	const updateArchiveField = (
		index: number,
		mutate: (archive: NonNullable<ClassifiedImportFile["archive"]>) => void,
	) => {
		setRows((prev) =>
			prev.map((row, i) => {
				if (i !== index || !row.archive) {
					return row;
				}
				const archive = structuredClone(row.archive);
				mutate(archive);
				const externalKey = archive.meta.number
					? buildExternalKey({
							provider: row.detectedOrigin.provider,
							number: archive.meta.number,
							issueDate: archive.meta.issueDate || "unknown",
						})
					: row.externalKey;
				return { ...row, archive, externalKey };
			}),
		);
	};

	const onUploaded = (files: Array<{ name: string; ufsUrl: string }>) => {
		setMessage(null);
		startTransition(async () => {
			const result = await classifyImportPdfs({
				issuerId,
				defaultPaid,
				files: files.map((f) => ({
					fileName: f.name,
					pdfUrl: f.ufsUrl,
				})),
			});
			if (result.error) {
				setMessage(result.error);
				return;
			}
			setRows((prev) => [...prev, ...result.rows]);
		});
	};

	const onCommit = () => {
		setMessage(null);
		startTransition(async () => {
			const items: CommitImportItem[] = [];
			for (const row of rows) {
				if (!archiveReady(row)) {
					continue;
				}
				if (row.status === "ready_full" && row.invoice) {
					items.push({
						fileName: row.fileName,
						pdfUrl: row.pdfUrl,
						isdocXml: row.isdocXml,
						completeness: "full",
						invoice: row.invoice,
						externalKey:
							row.externalKey ??
							buildExternalKey({
								provider: originProvider,
								number: row.invoice.meta.number,
								issueDate: row.invoice.meta.issueDate,
							}),
						origin: {
							provider: originProvider,
							label: originLabel || row.detectedOrigin.label,
							version: originVersion || row.detectedOrigin.version,
						},
						paid: row.paid,
						paidAt: row.invoice.meta.issueDate,
					});
				} else if (row.archive) {
					const due = row.archive.meta.dueDate || row.archive.meta.issueDate;
					items.push({
						fileName: row.fileName,
						pdfUrl: row.pdfUrl,
						completeness: "archive",
						archive: {
							...row.archive,
							meta: {
								...row.archive.meta,
								dueDate: due,
								duzp: row.archive.meta.duzp || row.archive.meta.issueDate,
							},
						},
						externalKey:
							row.externalKey ??
							buildExternalKey({
								provider: originProvider,
								number: row.archive.meta.number,
								issueDate: row.archive.meta.issueDate,
							}),
						origin: {
							provider: originProvider,
							label: originLabel || row.detectedOrigin.label,
							version: originVersion || row.detectedOrigin.version,
						},
						paid: row.paid,
						paidAt: row.archive.meta.issueDate,
					});
				}
			}

			const result = await commitInvoiceImport({
				issuerId,
				originProvider,
				originLabel: originLabel || undefined,
				originVersion: originVersion || undefined,
				defaultPaid,
				items,
			});
			setMessage(
				`Import hotov: ${result.created} vytvořeno, ${result.skipped} přeskočeno, ${result.failed} chyb.`,
			);
			if (result.created > 0) {
				router.push(
					`/invoices?toast=import&ok=${result.created}&skipped=${result.skipped}&failed=${result.failed}`,
				);
				router.refresh();
			}
		});
	};

	if (issuers.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				Nejdřív vytvořte{" "}
				<Link className="underline" href="/issuers">
					dodavatele
				</Link>
				.
			</p>
		);
	}

	return (
		<div className="space-y-6">
			<div className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="issuerId">Dodavatel (vystavitel)</Label>
					<select
						className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
						id="issuerId"
						onChange={(e) => setIssuerId(e.target.value)}
						value={issuerId}
					>
						{issuers.map((i) => (
							<option key={i.id} value={i.id}>
								{i.name}
							</option>
						))}
					</select>
				</div>
				<div className="space-y-2">
					<Label htmlFor="originProvider">Zdroj vystavení</Label>
					<select
						className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
						id="originProvider"
						onChange={(e) =>
							setOriginProvider(e.target.value as InvoiceOriginProvider)
						}
						value={originProvider}
					>
						{PROVIDERS.map((p) => (
							<option key={p} value={p}>
								{ORIGIN_PROVIDER_LABELS[p]}
							</option>
						))}
					</select>
				</div>
				<div className="space-y-2">
					<Label htmlFor="originVersion">Verze (volitelné)</Label>
					<Input
						id="originVersion"
						onChange={(e) => setOriginVersion(e.target.value)}
						placeholder="např. 0.4.0"
						value={originVersion}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="originLabel">Vlastní popisek (volitelné)</Label>
					<Input
						id="originLabel"
						onChange={(e) => setOriginLabel(e.target.value)}
						placeholder="např. starý Word šablona"
						value={originLabel}
					/>
				</div>
				<label className="flex items-center gap-2 text-sm md:col-span-2">
					<Checkbox
						checked={defaultPaid}
						onCheckedChange={(v) => setDefaultPaid(v === true)}
					/>
					Výchozí: označit importované jako zaplacené
				</label>
			</div>

			<div className="rounded-md border p-4">
				<p className="mb-3 text-sm font-medium">Nahrajte PDF faktury (až 40 najednou)</p>
				<UploadDropzone
					endpoint="importedInvoicePdf"
					onClientUploadComplete={(res) => {
						if (!res?.length) {
							return;
						}
						onUploaded(
							res.map((f) => ({
								name: f.name,
								ufsUrl: f.ufsUrl,
							})),
						);
					}}
					onUploadError={(err) => setMessage(err.message)}
				/>
			</div>

			{rows.length > 0 ? (
				<div className="space-y-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<p className="text-sm">
							K importu připraveno: {readyCount} / {rows.length}
						</p>
						<Button disabled={pending || readyCount === 0} onClick={onCommit}>
							Importovat {readyCount} faktur
						</Button>
					</div>
					<div className="rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Soubor</TableHead>
									<TableHead>Stav</TableHead>
									<TableHead>Číslo</TableHead>
									<TableHead>Klient</TableHead>
									<TableHead>Datum</TableHead>
									<TableHead>Celkem</TableHead>
									<TableHead>Zaplaceno</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((row, index) => (
									<TableRow key={`${row.pdfUrl}-${index}`}>
										<TableCell className="max-w-[10rem] truncate text-xs">
											{row.fileName}
										</TableCell>
										<TableCell className="text-xs">
											{row.status === "ready_full"
												? "ISDOC"
												: row.status === "needs_archive_fields"
													? "Archiv"
													: `Chyba: ${row.error ?? "?"}`}
										</TableCell>
										<TableCell>
											{row.invoice ? (
												<span className="text-sm">{row.invoice.meta.number}</span>
											) : (
												<Input
													className="h-8 w-28"
													onChange={(e) =>
														updateArchiveField(index, (a) => {
															a.meta.number = e.target.value;
														})
													}
													placeholder="číslo"
													value={row.archive?.meta.number ?? ""}
												/>
											)}
										</TableCell>
										<TableCell>
											{row.invoice ? (
												<span className="text-sm">{row.invoice.client.name}</span>
											) : (
												<Input
													className="h-8 w-36"
													onChange={(e) =>
														updateArchiveField(index, (a) => {
															a.client.name = e.target.value;
														})
													}
													placeholder="odběratel"
													value={row.archive?.client.name ?? ""}
												/>
											)}
										</TableCell>
										<TableCell>
											{row.invoice ? (
												<span className="text-sm">{row.invoice.meta.issueDate}</span>
											) : (
												<div className="flex flex-col gap-1">
													<Input
														className="h-8 w-32"
														onChange={(e) =>
															updateArchiveField(index, (a) => {
																a.meta.issueDate = e.target.value;
																if (!a.meta.dueDate) {
																	a.meta.dueDate = e.target.value;
																}
															})
														}
														type="date"
														value={row.archive?.meta.issueDate ?? ""}
													/>
												</div>
											)}
										</TableCell>
										<TableCell>
											{row.invoice ? (
												<span className="text-sm">
													{row.invoice.totals.total.toFixed(2)}
												</span>
											) : (
												<Input
													className="h-8 w-24"
													onChange={(e) =>
														updateArchiveField(index, (a) => {
															const total = Number(e.target.value);
															a.totals.total = Number.isFinite(total) ? total : 0;
															a.totals.subtotal = a.totals.total;
															a.totals.vatTotal = 0;
														})
													}
													placeholder="0"
													type="number"
													value={row.archive?.totals.total || ""}
												/>
											)}
										</TableCell>
										<TableCell>
											<Checkbox
												checked={row.paid}
												onCheckedChange={(v) =>
													updateRow(index, { paid: v === true })
												}
											/>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
					{rows.some((r) => r.status === "needs_archive_fields") ? (
						<p className="text-muted-foreground text-xs">
							Řádky bez ISDOC: doplňte číslo, odběratele, datum a částku. Uloží se
							originální PDF (archiv).
						</p>
					) : null}
				</div>
			) : null}

			{message ? <p className="text-muted-foreground text-sm">{message}</p> : null}
			{pending ? <p className="text-muted-foreground text-sm">Pracuji…</p> : null}
		</div>
	);
}
