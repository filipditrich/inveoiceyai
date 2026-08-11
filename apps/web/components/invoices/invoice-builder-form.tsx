"use client";

import { issueInvoice, saveInvoiceDraft } from "@/actions/invoices";
import {
	collectFormErrorMessages,
	Field,
	selectClassName,
} from "@/components/invoices/field";
import { InvoicePdfPreview } from "@/components/invoices/invoice-pdf-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	addDaysIso,
	todayIsoDate,
	tryBuildInvoicePayload,
	type BuilderLineInput,
} from "@/lib/build-invoice";
import { formatDateCs, formatMoney } from "@/lib/format";
import type { ClientOption, IssuerOption } from "@/lib/invoice-party-types";
import { cn } from "@/lib/utils";
import { nextInvoiceNumber } from "@invoicey/invoice-core/numbering";
import type { Invoice } from "@invoicey/invoice-core/schema";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import * as React from "react";
import {
	useFieldArray,
	useForm,
	type FieldErrors,
	type FieldPath,
} from "react-hook-form";
import { z } from "zod";

const isoDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Zadej platné datum");

const BuilderFormSchema = z
	.object({
		issuerId: z.string().uuid("Vyber vystavovatele"),
		clientId: z.string().uuid("Vyber odběratele"),
		docType: z.enum(["invoice", "proforma", "advance", "credit_note"]),
		issueDate: isoDate,
		dueDate: isoDate,
		duzp: isoDate,
		vatMode: z.enum(["regular", "reverse_charge", "oss"]),
		suppliesAbroad: z.enum(["none", "eu", "non_eu"]),
		legalNote: z.string().optional(),
		localReverseChargeCode: z.string().optional(),
		correctedInvoiceNumber: z.string().optional(),
		notes: z.string().optional(),
		items: z
			.array(
				z.object({
					description: z.string().min(1, "Popis je povinný"),
					quantity: z
						.number({ error: "Zadej množství" })
						.refine((q) => q !== 0, "Množství nesmí být 0"),
					unit: z.string().min(1, "Jednotka je povinná"),
					unitPriceWithoutVat: z
						.number({ error: "Zadej cenu" })
						.nonnegative("Cena nesmí být záporná"),
					vatRate: z.number({ error: "Zadej DPH %" }).min(0).max(100),
				}),
			)
			.min(1, "Přidej alespoň jednu položku"),
	})
	.refine((d) => d.dueDate >= d.issueDate, {
		message: "Splatnost nesmí být před datem vystavení",
		path: ["dueDate"],
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

function fieldError(
	errors: FieldErrors<BuilderFormValues>,
	name: FieldPath<BuilderFormValues>,
): string | undefined {
	const parts = name.split(".");
	let node: unknown = errors;
	for (const p of parts) {
		if (node == null || typeof node !== "object") {
			return undefined;
		}
		node = (node as Record<string, unknown>)[p];
	}
	if (node && typeof node === "object" && "message" in node) {
		const msg = (node as { message?: unknown }).message;
		return typeof msg === "string" ? msg : undefined;
	}
	return undefined;
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
		mode: "onBlur",
		defaultValues: {
			issuerId: initial?.issuerId ?? firstIssuer?.id ?? "",
			clientId: initial?.clientId ?? clients[0]?.id ?? "",
			docType: initial?.docType ?? "invoice",
			issueDate: defaultIssue,
			dueDate: initial?.dueDate ?? addDaysIso(defaultIssue, 14),
			duzp: initial?.duzp ?? defaultIssue,
			vatMode: initial?.vatMode ?? "regular",
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
	const errors = form.formState.errors;
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
	const [formErrorList, setFormErrorList] = React.useState<string[]>([]);

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
						e instanceof Error ? e.message : "Náhled se nepodařilo vytvořit",
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

	async function submit(action: "draft" | "issue") {
		if (submitting) {
			return;
		}
		const ok = await form.trigger();
		const values = form.getValues();
		const parsed = BuilderFormSchema.safeParse(values);
		if (!ok || !parsed.success) {
			const msgs = collectFormErrorMessages(
				form.formState.errors as Record<string, unknown>,
			);
			if (parsed.success === false) {
				for (const issue of parsed.error.issues.slice(0, 8)) {
					const path = issue.path.join(".");
					const line = path ? `${path}: ${issue.message}` : issue.message;
					if (!msgs.includes(line)) {
						msgs.push(line);
					}
				}
			}
			setFormErrorList(
				msgs.length > 0
					? msgs
					: ["Vyplň povinná pole a alespoň jednu validní položku."],
			);
			const firstKey = Object.keys(form.formState.errors)[0] as
				| FieldPath<BuilderFormValues>
				| undefined;
			if (firstKey) {
				void form.setFocus(firstKey);
			}
			return;
		}
		setFormErrorList([]);
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

	const alertMessages = [
		...(invalidQuery ? [humanInvalid(invalidQuery)] : []),
		...formErrorList,
	];

	return (
		<div className="grid gap-8 xl:grid-cols-2">
			<form
				className="space-y-6"
				onSubmit={(e) => {
					e.preventDefault();
				}}
			>
				{alertMessages.length > 0 ? (
					<div
						className="border-destructive/40 bg-destructive/10 text-destructive space-y-1 rounded-md border px-3 py-2 text-sm"
						role="alert"
					>
						<p className="font-medium">Oprav chyby ve formuláři</p>
						<ul className="list-inside list-disc text-xs">
							{alertMessages.slice(0, 8).map((m) => (
								<li key={m}>{m}</li>
							))}
						</ul>
					</div>
				) : null}

				<section className="grid gap-4 sm:grid-cols-2">
					<Field
						description="Tvůj podnik (dodavatel na faktuře)."
						error={fieldError(errors, "issuerId")}
						label="Vystavovatel"
					>
						<select
							aria-invalid={Boolean(fieldError(errors, "issuerId"))}
							className={selectClassName(Boolean(fieldError(errors, "issuerId")))}
							{...form.register("issuerId")}
						>
							{issuers.map((i) => (
								<option key={i.id} value={i.id}>
									{i.snapshot.name}
								</option>
							))}
						</select>
					</Field>
					<Field
						description="Odběratel z registru klientů (ARES)."
						error={fieldError(errors, "clientId")}
						label="Odběratel"
					>
						<select
							aria-invalid={Boolean(fieldError(errors, "clientId"))}
							className={selectClassName(Boolean(fieldError(errors, "clientId")))}
							{...form.register("clientId")}
						>
							{clients.map((c) => (
								<option key={c.id} value={c.id}>
									{c.snapshot.name}
								</option>
							))}
						</select>
					</Field>
				</section>

				<section className="grid gap-4 sm:grid-cols-2">
					<Field
						description="Typ daňového / platebního dokladu."
						error={fieldError(errors, "docType")}
						label="Typ dokladu"
					>
						<select
							className={selectClassName()}
							{...form.register("docType")}
						>
							<option value="invoice">Faktura</option>
							<option value="proforma">Proforma</option>
							<option value="advance">Záloha</option>
							<option value="credit_note">Dobropis</option>
						</select>
					</Field>
					<Field
						description="Číslo se přiřadí až při vystavení."
						label="Náhled čísla"
					>
						<p className="text-sm font-medium tabular-nums">{numberPreview}</p>
					</Field>
					<Field
						description={`Datum vystavení · ${formatDateCs(watched.issueDate)}`}
						error={fieldError(errors, "issueDate")}
						label="Datum vystavení"
					>
						<Input
							aria-invalid={Boolean(fieldError(errors, "issueDate"))}
							type="date"
							{...form.register("issueDate")}
						/>
					</Field>
					<Field
						description={`Splatnost · ${formatDateCs(watched.dueDate)}`}
						error={fieldError(errors, "dueDate")}
						label="Splatnost"
					>
						<Input
							aria-invalid={Boolean(fieldError(errors, "dueDate"))}
							type="date"
							{...form.register("dueDate")}
						/>
					</Field>
					<Field
						description={`Datum uskutečnění zdanitelného plnění · ${formatDateCs(watched.duzp)}`}
						error={fieldError(errors, "duzp")}
						label="DUZP"
					>
						<Input
							aria-invalid={Boolean(fieldError(errors, "duzp"))}
							type="date"
							{...form.register("duzp")}
						/>
					</Field>
					<Field
						description="MVP pouze CZK — měnu nelze změnit."
						label="Měna"
					>
						<p className="text-sm font-medium tabular-nums">CZK (Kč)</p>
					</Field>
					<Field
						description="Běžný režim, přenesení DPH, nebo OSS (advanced)."
						error={fieldError(errors, "vatMode")}
						label="Režim DPH"
					>
						<select
							className={selectClassName()}
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
					</Field>
					<Field
						description="Pro B2B dodání zboží/služeb do zahraničí."
						error={fieldError(errors, "suppliesAbroad")}
						label="Dodání do zahraničí"
					>
						<select
							className={selectClassName()}
							{...form.register("suppliesAbroad")}
						>
							<option value="none">Ne</option>
							<option value="eu">EU</option>
							<option value="non_eu">Mimo EU</option>
						</select>
					</Field>
				</section>

				{watched.vatMode === "reverse_charge" ? (
					<section className="grid gap-4 sm:grid-cols-2">
						<Field
							description="Text doložky na faktuře (např. Daň odvede zákazník)."
							error={fieldError(errors, "legalNote")}
							label="Právní doložka"
						>
							<Input
								placeholder="Daň odvede zákazník"
								{...form.register("legalNote")}
							/>
						</Field>
						<Field
							description="Kód režimu přenesení daňové povinnosti."
							error={fieldError(errors, "localReverseChargeCode")}
							label="Kód přenesení DPH"
						>
							<Input
								placeholder="např. 15"
								{...form.register("localReverseChargeCode")}
							/>
						</Field>
					</section>
				) : null}

				{watched.docType === "credit_note" ? (
					<Field
						description="Číslo původní faktury, kterou opravuješ."
						error={fieldError(errors, "correctedInvoiceNumber")}
						label="Opravovaná faktura"
					>
						<Input
							placeholder="20260001"
							{...form.register("correctedInvoiceNumber")}
						/>
					</Field>
				) : null}

				<section className="space-y-3">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="font-medium">Položky</h2>
							<p className="text-muted-foreground text-xs">
								Ceny zadávej bez DPH; celkem se počítá automaticky.
							</p>
						</div>
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
							Přidat řádek
						</Button>
					</div>
					{fieldError(errors, "items") ? (
						<p className="text-destructive text-xs">
							{fieldError(errors, "items")}
						</p>
					) : null}
					{fields.map((field, index) => {
						const line = watched.items[index];
						const lineTotal =
							(Number(line?.quantity) || 0) *
							(Number(line?.unitPriceWithoutVat) || 0) *
							(1 + (Number(line?.vatRate) || 0) / 100);
						const descErr = fieldError(
							errors,
							`items.${index}.description` as FieldPath<BuilderFormValues>,
						);
						return (
							<div
								className={cn(
									"grid gap-2 rounded-md border p-3 sm:grid-cols-6",
									(descErr ||
										fieldError(
											errors,
											`items.${index}.quantity` as FieldPath<BuilderFormValues>,
										)) &&
										"border-destructive/50",
								)}
								key={field.id}
							>
								<div className="space-y-1 sm:col-span-2">
									<Input
										aria-invalid={Boolean(descErr)}
										placeholder="Popis služby / zboží"
										{...form.register(`items.${index}.description`)}
									/>
									{descErr ? (
										<p className="text-destructive text-xs">{descErr}</p>
									) : null}
								</div>
								<div className="space-y-1">
									<Input
										aria-invalid={Boolean(
											fieldError(
												errors,
												`items.${index}.quantity` as FieldPath<BuilderFormValues>,
											),
										)}
										placeholder="Množství"
										step="any"
										type="number"
										{...form.register(`items.${index}.quantity`, {
											valueAsNumber: true,
										})}
									/>
								</div>
								<div className="space-y-1">
									<Input
										placeholder="ks / hod"
										{...form.register(`items.${index}.unit`)}
									/>
								</div>
								<div className="space-y-1">
									<Input
										placeholder="Cena bez DPH"
										step="any"
										type="number"
										{...form.register(`items.${index}.unitPriceWithoutVat`, {
											valueAsNumber: true,
										})}
									/>
								</div>
								<div className="flex flex-col gap-1">
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
									<p className="text-muted-foreground text-xs tabular-nums">
										{formatMoney(lineTotal)}
									</p>
								</div>
							</div>
						);
					})}
					{totalsPreview ? (
						<p className="text-sm font-medium tabular-nums">
							Celkem: {formatMoney(totalsPreview.total)} (DPH{" "}
							{formatMoney(totalsPreview.vatTotal)})
						</p>
					) : null}
				</section>

				<Field
					description="Volitelný text na PDF pod položkami."
					error={fieldError(errors, "notes")}
					label="Poznámka"
				>
					<Input
						placeholder="Např. děkujeme za spolupráci"
						{...form.register("notes")}
					/>
				</Field>

				<div className="flex flex-wrap gap-2">
					<Button
						disabled={submitting !== null}
						onClick={() => void submit("draft")}
						type="button"
						variant="outline"
					>
						{submitting === "draft" ? "Ukládám…" : "Uložit draft"}
					</Button>
					<Button
						disabled={submitting !== null}
						onClick={() => void submit("issue")}
						type="button"
					>
						{submitting === "issue" ? "Vystavuji…" : "Vystavit"}
					</Button>
					<span className="text-muted-foreground self-center text-xs">
						{mode === "edit" ? "Úprava draftu" : "Nová faktura"}
					</span>
				</div>
			</form>

			<InvoicePdfPreview
				error={previewError}
				updating={previewUpdating}
				url={previewUrl}
			/>
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
			issues?: {
				formErrors?: string[];
				fieldErrors?: Record<string, string[] | undefined>;
			};
		} | null;
		const parts: string[] = [];
		if (body?.error) {
			parts.push(body.error);
		}
		if (body?.issues?.formErrors?.length) {
			parts.push(...body.issues.formErrors);
		}
		if (body?.issues?.fieldErrors) {
			for (const [k, msgs] of Object.entries(body.issues.fieldErrors)) {
				if (msgs?.length) {
					parts.push(`${k}: ${msgs.join(", ")}`);
				}
			}
		}
		throw new Error(parts.join(" · ") || `preview ${res.status}`);
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
		cannot_issue: "Draft nelze vystavit.",
	};
	return map[code] ?? `Chyba: ${code}`;
}
