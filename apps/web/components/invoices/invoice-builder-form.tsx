"use client";

import { issueInvoice, saveInvoiceDraft } from "@/actions/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	addDaysIso,
	todayIsoDate,
	tryBuildInvoicePayload,
	type BuilderLineInput,
} from "@/lib/build-invoice";
import type { ClientOption, IssuerOption } from "@/lib/invoice-party-types";
import { nextInvoiceNumber } from "@invoicey/invoice-core/numbering";
import type { Invoice } from "@invoicey/invoice-core/schema";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

const BuilderFormSchema = z.object({
	issuerId: z.string().uuid(),
	clientId: z.string().uuid(),
	docType: z.enum(["invoice", "proforma", "advance", "credit_note"]),
	issueDate: z.string().min(1),
	dueDate: z.string().min(1),
	duzp: z.string().min(1),
	vatMode: z.enum(["regular", "reverse_charge", "oss"]),
	suppliesAbroad: z.enum(["none", "eu", "non_eu"]),
	legalNote: z.string().optional(),
	localReverseChargeCode: z.string().optional(),
	correctedInvoiceNumber: z.string().optional(),
	notes: z.string().optional(),
	items: z
		.array(
			z.object({
				description: z.string().min(1),
				quantity: z.number().refine((q) => q !== 0),
				unit: z.string().min(1),
				unitPriceWithoutVat: z.number().nonnegative(),
				vatRate: z.number().min(0).max(100),
			}),
		)
		.min(1),
});

type BuilderFormValues = z.infer<typeof BuilderFormSchema>;

export type { ClientOption, IssuerOption };

export interface InvoiceBuilderFormProps {
	mode: "create" | "edit";
	invoiceId?: string;
	invalidQuery?: string | null;
	issuers: IssuerOption[];
	clients: ClientOption[];
	initial?: Partial<BuilderFormValues> & { numberPreview?: string };
}

export function InvoiceBuilderForm({
	mode,
	invoiceId,
	invalidQuery,
	issuers,
	clients,
	initial,
}: InvoiceBuilderFormProps) {
	const defaultIssue = initial?.issueDate ?? todayIsoDate();
	const firstIssuer = issuers[0];
	const form = useForm<BuilderFormValues>({
		resolver: standardSchemaResolver(BuilderFormSchema),
		defaultValues: {
			issuerId: initial?.issuerId ?? firstIssuer?.id ?? "",
			clientId: initial?.clientId ?? clients[0]?.id ?? "",
			docType: initial?.docType ?? "invoice",
			issueDate: defaultIssue,
			dueDate: initial?.dueDate ?? addDaysIso(defaultIssue, 14),
			duzp: initial?.duzp ?? defaultIssue,
			vatMode:
				initial?.vatMode ??
				(firstIssuer && !firstIssuer.snapshot.vatPayer
					? "regular"
					: "regular"),
			suppliesAbroad: initial?.suppliesAbroad ?? "none",
			legalNote: initial?.legalNote ?? "",
			localReverseChargeCode: initial?.localReverseChargeCode ?? "",
			correctedInvoiceNumber: initial?.correctedInvoiceNumber ?? "",
			notes: initial?.notes ?? "",
			items: initial?.items ?? [
				{
					description: "",
					quantity: 1,
					unit: "ks",
					unitPriceWithoutVat: 0,
					vatRate: 21,
				},
			],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "items",
	});

	const watched = form.watch();
	const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
	const previewUrlRef = React.useRef<string | null>(null);
	const lastPreviewKeyRef = React.useRef<string | null>(null);
	const [previewError, setPreviewError] = React.useState<string | null>(null);
	const [previewUpdating, setPreviewUpdating] = React.useState(false);
	const [numberPreview, setNumberPreview] = React.useState(
		initial?.numberPreview ?? "—",
	);
	const [submitting, setSubmitting] = React.useState<"draft" | "issue" | null>(
		null,
	);
	const [showAdvancedVat, setShowAdvancedVat] = React.useState(
		() => initial?.vatMode === "oss",
	);

	React.useEffect(() => {
		return () => {
			if (previewUrlRef.current) {
				URL.revokeObjectURL(previewUrlRef.current);
			}
		};
	}, []);

	React.useEffect(() => {
		const issuer = issuers.find((i) => i.id === watched.issuerId);
		if (!issuer || initial?.vatMode) {
			return;
		}
		/** non–VAT-payer forces regular; VAT payer keeps current unless OSS locked */
		if (!issuer.snapshot.vatPayer && watched.vatMode !== "regular") {
			form.setValue("vatMode", "regular");
		}
	}, [watched.issuerId, issuers, form, initial?.vatMode, watched.vatMode]);

	React.useEffect(() => {
		const issuer = issuers.find((i) => i.id === watched.issuerId);
		if (!issuer) {
			setNumberPreview("—");
			return;
		}
		const scheme = issuer.schemes.find((s) => s.docType === watched.docType);
		if (!scheme) {
			setNumberPreview("(chybí schéma)");
			return;
		}
		try {
			const n = nextInvoiceNumber(
				{
					template: scheme.template,
					counter: scheme.counter,
					counterYear: scheme.counterYear ?? undefined,
					resetPeriod: scheme.resetPeriod === "never" ? "never" : "yearly",
					padding: scheme.padding,
					docType: watched.docType,
					issuerName: issuer.snapshot.name,
				},
				new Date(`${watched.issueDate}T12:00:00.000Z`),
			);
			setNumberPreview((prev) => (prev === n ? prev : n));
		} catch {
			setNumberPreview("—");
		}
	}, [issuers, watched.issuerId, watched.docType, watched.issueDate]);

	/** stable key — `form.watch()` returns a new object every render */
	const previewBuild = React.useMemo(() => {
		const issuer = issuers.find((i) => i.id === watched.issuerId)?.snapshot;
		const client = clients.find((c) => c.id === watched.clientId)?.snapshot;
		if (!issuer || !client) {
			return { invoice: null as Invoice | null, error: null as string | null };
		}
		const lines: BuilderLineInput[] = watched.items.map((it) => ({
			description: it.description || "—",
			quantity: Number(it.quantity) || 1,
			unit: it.unit || "ks",
			unitPriceWithoutVat: Number(it.unitPriceWithoutVat) || 0,
			vatRate: Number(it.vatRate) || 0,
		}));
		const built = tryBuildInvoicePayload({
			docType: watched.docType,
			number:
				numberPreview !== "—" && !numberPreview.startsWith("(")
					? numberPreview
					: "DRAFT",
			issueDate: watched.issueDate,
			dueDate: watched.dueDate,
			duzp: watched.duzp,
			issuer,
			client,
			vatMode: watched.vatMode,
			suppliesAbroad: watched.suppliesAbroad,
			legalNote: watched.legalNote || undefined,
			localReverseChargeCode: watched.localReverseChargeCode || undefined,
			correctedInvoiceNumber: watched.correctedInvoiceNumber || undefined,
			items: lines,
			notes: watched.notes || undefined,
		});
		if (!built.ok) {
			return { invoice: null, error: built.message };
		}
		return { invoice: built.invoice, error: null };
	}, [
		issuers,
		clients,
		numberPreview,
		watched.issuerId,
		watched.clientId,
		watched.docType,
		watched.issueDate,
		watched.dueDate,
		watched.duzp,
		watched.vatMode,
		watched.suppliesAbroad,
		watched.legalNote,
		watched.localReverseChargeCode,
		watched.correctedInvoiceNumber,
		watched.notes,
		watched.items,
	]);

	const previewKey = previewBuild.invoice
		? JSON.stringify(previewBuild.invoice)
		: null;

	React.useEffect(() => {
		if (previewBuild.error) {
			setPreviewError(previewBuild.error);
			return;
		}
		if (!previewKey || !previewBuild.invoice) {
			return;
		}
		if (previewKey === lastPreviewKeyRef.current) {
			return;
		}

		const invoice = previewBuild.invoice;
		const controller = new AbortController();
		const handle = window.setTimeout(() => {
			setPreviewUpdating(true);
			void refreshPreview(invoice, controller.signal)
				.then((url) => {
					if (controller.signal.aborted || !url) {
						return;
					}
					lastPreviewKeyRef.current = previewKey;
					if (previewUrlRef.current && previewUrlRef.current !== url) {
						URL.revokeObjectURL(previewUrlRef.current);
					}
					previewUrlRef.current = url;
					setPreviewUrl(url);
					setPreviewError(null);
				})
				.catch((e: unknown) => {
					if (controller.signal.aborted) {
						return;
					}
					if (e instanceof Error && e.name === "AbortError") {
						return;
					}
					setPreviewError(
						e instanceof Error ? e.message : "preview failed",
					);
				})
				.finally(() => {
					if (!controller.signal.aborted) {
						setPreviewUpdating(false);
					}
				});
		}, 700);

		return () => {
			window.clearTimeout(handle);
			controller.abort();
		};
	}, [previewKey, previewBuild.error, previewBuild.invoice]);

	const totalsPreview = React.useMemo(() => {
		const issuer = issuers.find((i) => i.id === watched.issuerId)?.snapshot;
		const client = clients.find((c) => c.id === watched.clientId)?.snapshot;
		if (!issuer || !client) {
			return null;
		}
		const built = tryBuildInvoicePayload({
			docType: watched.docType,
			number: "DRAFT",
			issueDate: watched.issueDate,
			dueDate: watched.dueDate,
			duzp: watched.duzp,
			issuer,
			client,
			vatMode: watched.vatMode,
			suppliesAbroad: watched.suppliesAbroad,
			items: watched.items.map((it) => ({
				description: it.description || "—",
				quantity: Number(it.quantity) || 1,
				unit: it.unit || "ks",
				unitPriceWithoutVat: Number(it.unitPriceWithoutVat) || 0,
				vatRate: Number(it.vatRate) || 0,
			})),
		});
		return built.ok ? built.invoice.totals : null;
	}, [watched, issuers, clients]);

	const [formError, setFormError] = React.useState<string | null>(null);

	async function submit(action: "draft" | "issue") {
		if (submitting) {
			return;
		}
		const ok = await form.trigger();
		const values = form.getValues();
		const parsed = BuilderFormSchema.safeParse(values);
		if (!ok || !parsed.success) {
			setFormError("Vyplň povinná pole a alespoň jednu validní položku.");
			return;
		}
		setFormError(null);
		setSubmitting(action);
		const fd = new FormData();
		if (invoiceId) {
			fd.set("id", invoiceId);
		}
		fd.set("issuerId", values.issuerId);
		fd.set("clientId", values.clientId);
		fd.set("docType", values.docType);
		fd.set("issueDate", values.issueDate);
		fd.set("dueDate", values.dueDate);
		fd.set("duzp", values.duzp);
		fd.set("vatMode", values.vatMode);
		fd.set("suppliesAbroad", values.suppliesAbroad);
		if (values.legalNote) {
			fd.set("legalNote", values.legalNote);
		}
		if (values.localReverseChargeCode) {
			fd.set("localReverseChargeCode", values.localReverseChargeCode);
		}
		if (values.correctedInvoiceNumber) {
			fd.set("correctedInvoiceNumber", values.correctedInvoiceNumber);
		}
		if (values.notes) {
			fd.set("notes", values.notes);
		}
		fd.set("itemsJson", JSON.stringify(values.items));
		try {
			if (action === "draft") {
				await saveInvoiceDraft(fd);
			} else {
				await issueInvoice(fd);
			}
		} finally {
			setSubmitting(null);
		}
	}

	if (issuers.length === 0 || clients.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				Nejdřív založ{" "}
				{issuers.length === 0 ? (
					<a className="underline" href="/issuers/new">
						vystavovatele
					</a>
				) : null}
				{issuers.length === 0 && clients.length === 0 ? " a " : null}
				{clients.length === 0 ? (
					<a className="underline" href="/clients/new">
						odběratele
					</a>
				) : null}
				.
			</p>
		);
	}

	return (
		<div className="grid gap-8 xl:grid-cols-2">
			<form
				className="space-y-6"
				onSubmit={(e) => {
					e.preventDefault();
				}}
			>
				{invalidQuery ? (
					<p className="text-destructive text-sm">
						{humanInvalid(invalidQuery)}
					</p>
				) : null}
				{formError ? (
					<p className="text-destructive text-sm">{formError}</p>
				) : null}

				<section className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label>Vystavovatel</Label>
						<select
							className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
							{...form.register("issuerId")}
						>
							{issuers.map((i) => (
								<option key={i.id} value={i.id}>
									{i.snapshot.name}
								</option>
							))}
						</select>
					</div>
					<div className="space-y-2">
						<Label>Odběratel</Label>
						<select
							className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
							{...form.register("clientId")}
						>
							{clients.map((c) => (
								<option key={c.id} value={c.id}>
									{c.snapshot.name}
								</option>
							))}
						</select>
					</div>
				</section>

				<section className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label>Typ dokladu</Label>
						<select
							className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
							{...form.register("docType")}
						>
							<option value="invoice">Faktura</option>
							<option value="proforma">Proforma</option>
							<option value="advance">Záloha</option>
							<option value="credit_note">Dobropis</option>
						</select>
					</div>
					<div className="space-y-2">
						<Label>Náhled čísla</Label>
						<p className="text-sm font-medium tabular-nums">{numberPreview}</p>
					</div>
					<div className="space-y-2">
						<Label>Datum vystavení</Label>
						<Input type="date" {...form.register("issueDate")} />
					</div>
					<div className="space-y-2">
						<Label>Splatnost</Label>
						<Input type="date" {...form.register("dueDate")} />
					</div>
					<div className="space-y-2">
						<Label>DUZP</Label>
						<Input type="date" {...form.register("duzp")} />
					</div>
					<div className="space-y-2">
						<Label>Režim DPH</Label>
						<select
							className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
							{...form.register("vatMode")}
						>
							<option value="regular">Běžný</option>
							<option value="reverse_charge">Přenesení DPH</option>
							{showAdvancedVat ? <option value="oss">OSS</option> : null}
						</select>
						<label className="text-muted-foreground flex items-center gap-2 text-xs">
							<input
								checked={showAdvancedVat}
								onChange={(ev) => {
									setShowAdvancedVat(ev.target.checked);
									if (!ev.target.checked && watched.vatMode === "oss") {
										form.setValue("vatMode", "regular");
									}
								}}
								type="checkbox"
							/>
							Advanced (OSS)
						</label>
					</div>
					<div className="space-y-2">
						<Label>Dodání do zahraničí</Label>
						<select
							className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
							{...form.register("suppliesAbroad")}
						>
							<option value="none">Ne</option>
							<option value="eu">EU</option>
							<option value="non_eu">Mimo EU</option>
						</select>
					</div>
				</section>

				{watched.vatMode === "reverse_charge" ? (
					<section className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label>Právní doložka (reverse charge)</Label>
							<Input {...form.register("legalNote")} />
						</div>
						<div className="space-y-2">
							<Label>Kód přenesení DPH</Label>
							<Input {...form.register("localReverseChargeCode")} />
						</div>
					</section>
				) : null}

				{watched.docType === "credit_note" ? (
					<div className="space-y-2">
						<Label>Opravovaná faktura</Label>
						<Input {...form.register("correctedInvoiceNumber")} />
					</div>
				) : null}

				<section className="space-y-3">
					<div className="flex items-center justify-between">
						<h2 className="font-medium">Položky</h2>
						<Button
							onClick={() => {
								append({
									description: "",
									quantity: 1,
									unit: "ks",
									unitPriceWithoutVat: 0,
									vatRate: 21,
								});
							}}
							size="sm"
							type="button"
							variant="secondary"
						>
							Add line
						</Button>
					</div>
					{fields.map((field, index) => (
						<div
							className="grid gap-2 rounded-md border p-3 sm:grid-cols-6"
							key={field.id}
						>
							<div className="sm:col-span-2">
								<Input
									placeholder="Popis"
									{...form.register(`items.${index}.description`)}
								/>
							</div>
							<Input
								placeholder="Množství"
								step="any"
								type="number"
								{...form.register(`items.${index}.quantity`, {
									valueAsNumber: true,
								})}
							/>
							<Input
								placeholder="Jedn."
								{...form.register(`items.${index}.unit`)}
							/>
							<Input
								placeholder="Cena bez DPH"
								step="any"
								type="number"
								{...form.register(`items.${index}.unitPriceWithoutVat`, {
									valueAsNumber: true,
								})}
							/>
							<div className="flex gap-1">
								<Input
									placeholder="DPH %"
									step="1"
									type="number"
									{...form.register(`items.${index}.vatRate`, {
										valueAsNumber: true,
									})}
								/>
								<Button
									onClick={() => {
										if (fields.length > 1) {
											remove(index);
										}
									}}
									size="sm"
									type="button"
									variant="ghost"
								>
									×
								</Button>
							</div>
						</div>
					))}
					{totalsPreview ? (
						<p className="text-muted-foreground text-sm">
							Celkem: {totalsPreview.total.toFixed(2)} CZK (DPH{" "}
							{totalsPreview.vatTotal.toFixed(2)})
						</p>
					) : null}
				</section>

				<div className="space-y-2">
					<Label>Poznámka</Label>
					<Input {...form.register("notes")} />
				</div>

				<div className="flex flex-wrap gap-2">
					<Button
						disabled={submitting !== null}
						onClick={() => void submit("draft")}
						type="button"
						variant="outline"
					>
						{submitting === "draft" ? "Saving…" : "Save draft"}
					</Button>
					<Button
						disabled={submitting !== null}
						onClick={() => void submit("issue")}
						type="button"
					>
						{submitting === "issue" ? "Issuing…" : "Issue"}
					</Button>
					<span className="text-muted-foreground self-center text-xs">
						{mode === "edit" ? "Úprava draftu" : "Nová faktura"}
					</span>
				</div>
			</form>

			<div className="space-y-2">
				<div className="flex items-center justify-between gap-2">
					<h2 className="font-medium">Náhled PDF</h2>
					{previewUpdating ? (
						<span className="text-muted-foreground text-xs">Updating…</span>
					) : null}
				</div>
				{previewError ? (
					<p className="text-destructive text-xs">{previewError}</p>
				) : null}
				{previewUrl ? (
					<iframe
						className="bg-muted h-[70vh] w-full rounded-md border"
						src={previewUrl}
						title="Invoice PDF preview"
					/>
				) : (
					<div className="bg-muted text-muted-foreground flex h-[70vh] items-center justify-center rounded-md border text-sm">
						Vyplň položky pro náhled…
					</div>
				)}
			</div>
		</div>
	);
}

async function refreshPreview(
	invoice: Invoice,
	signal: AbortSignal,
): Promise<string | null> {
	const res = await fetch("/api/demo/invoice-pdf", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(invoice),
		signal,
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as {
			error?: string;
		} | null;
		throw new Error(body?.error ?? `preview ${res.status}`);
	}
	const blob = await res.blob();
	return URL.createObjectURL(blob);
}

function humanInvalid(code: string): string {
	const map: Record<string, string> = {
		required_fields: "Vyber vystavovatele, odběratele a alespoň jednu položku.",
		missing_parties: "Vystavovatel nebo odběratel nenalezen.",
		validation: "Faktura neprošla validací schématu.",
		missing_scheme: "Chybí číslovací schéma pro typ dokladu.",
		already_issued: "Faktura už je vystavená.",
		not_draft: "Lze upravit jen draft.",
	};
	return map[code] ?? `Chyba: ${code}`;
}
