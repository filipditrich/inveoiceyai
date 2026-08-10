"use client";

import { saveIssuer } from "@/actions/issuers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadButton } from "@/lib/uploadthing";
import type { ClientDraft } from "@invoicey/ares";
import { nextInvoiceNumber } from "@invoicey/invoice-core/numbering";
import type { IssuerSnapshot } from "@invoicey/invoice-core/schema";
import { IcoSchema } from "@invoicey/invoice-core/schema";
import type { FormEvent } from "react";
import * as React from "react";

const DOC_TYPES = [
	{ key: "invoice", label: "Faktura (FV)" },
	{ key: "proforma", label: "Proforma (PF)" },
	{ key: "advance", label: "Záloha (ZF)" },
	{ key: "credit_note", label: "Dobropis (DOB)" },
] as const;

const DEFAULT_TEMPLATES: Record<(typeof DOC_TYPES)[number]["key"], string> = {
	invoice: "{YYYY}{####}",
	proforma: "PF-{YYYY}-{####}",
	advance: "ZF-{YYYY}-{####}",
	credit_note: "DOB-{YYYY}-{####}",
};

export type NumberingSchemeDraft = {
	docType: (typeof DOC_TYPES)[number]["key"];
	template: string;
	resetPeriod: "yearly" | "never";
	counter: number;
	counterYear: number | null;
	padding: number;
};

export interface IssuerEditorFormProps {
	mode: "create" | "edit";
	invalidQuery?: string | null;
	snapshot?: IssuerSnapshot;
	schemes?: NumberingSchemeDraft[];
	uploadConfigured?: boolean;
}

export function IssuerEditorForm({
	mode,
	invalidQuery,
	snapshot,
	schemes,
	uploadConfigured = false,
}: IssuerEditorFormProps) {
	const [createdId] = React.useState(() => crypto.randomUUID());
	const persistedId = mode === "edit" ? (snapshot?.id ?? "") : createdId;

	if (mode === "edit" && persistedId.length === 0) {
		throw new Error("IssuerEditorForm(edit) requires snapshot.id");
	}

	const yearNow = new Date().getFullYear();

	const [source, setSource] = React.useState<"ares" | "manual">("manual");
	const [icoInput, setIcoInput] = React.useState(snapshot?.ico ?? "");
	const [name, setName] = React.useState(snapshot?.name ?? "");
	const [dic, setDic] = React.useState(snapshot?.dic ?? "");
	const [street, setStreet] = React.useState(snapshot?.address.street ?? "");
	const [city, setCity] = React.useState(snapshot?.address.city ?? "");
	const [zip, setZip] = React.useState(snapshot?.address.zip ?? "");
	const [country, setCountry] = React.useState<string>(
		snapshot?.address.country ?? "CZ",
	);
	const [contactEmail, setContactEmail] = React.useState(
		snapshot?.contactEmail ?? "",
	);
	const [accountNumber, setAccountNumber] = React.useState(
		snapshot?.bank.accountNumber ?? "",
	);
	const [iban, setIban] = React.useState(snapshot?.bank.iban ?? "");
	const [bic, setBic] = React.useState(snapshot?.bank.bic ?? "");
	const [vatPayer, setVatPayer] = React.useState(snapshot?.vatPayer ?? true);
	const [registryNote, setRegistryNote] = React.useState(
		snapshot?.registryNote ?? "",
	);
	const [logoUrl, setLogoUrl] = React.useState(snapshot?.logoUrl ?? "");
	const [stampUrl, setStampUrl] = React.useState(snapshot?.stampUrl ?? "");
	const [signatureUrl, setSignatureUrl] = React.useState(
		snapshot?.signatureUrl ?? "",
	);
	const [lookupMsg, setLookupMsg] = React.useState<string | null>(() =>
		lookupMessageFromInvalid(invalidQuery),
	);

	const [schemeState, setSchemeState] = React.useState(() => {
		const map = new Map(schemes?.map((s) => [s.docType, s]));
		return DOC_TYPES.map((d) => {
			const existing = map.get(d.key);
			return {
				docType: d.key,
				template: existing?.template ?? DEFAULT_TEMPLATES[d.key],
				resetPeriod: existing?.resetPeriod ?? ("yearly" as const),
				counter: existing?.counter ?? 0,
				counterYear: existing?.counterYear ?? yearNow,
				padding: existing?.padding ?? 4,
			};
		});
	});

	async function onLookupFromAres() {
		setLookupMsg(null);
		const raw = (icoInput ?? "").replace(/\s/g, "");
		const parsed = IcoSchema.safeParse(raw);
		if (!parsed.success) {
			setLookupMsg("Zadejte platné osmimístné IČO.");
			return;
		}
		const res = await fetch(`/api/ares/${parsed.data}`);
		let payload: unknown;
		try {
			payload = await res.json();
		} catch {
			setLookupMsg("ARES nevrátila JSON.");
			return;
		}
		if (
			payload &&
			typeof payload === "object" &&
			"ok" in payload &&
			payload.ok === true &&
			"draft" in payload
		) {
			const draft = (payload as { draft: ClientDraft }).draft;
			setSource("ares");
			setName(draft.name);
			setDic(draft.dic ?? "");
			setStreet(draft.address.street);
			setCity(draft.address.city);
			setZip(draft.address.zip);
			setCountry(draft.address.country);
			if (draft.contactEmail) {
				setContactEmail(draft.contactEmail);
			}
			if (draft.ico) {
				setIcoInput(draft.ico);
			}
			return;
		}
		setLookupMsg(aresErrorHuman(payload));
	}

	async function onSubmit(e: FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const fd = new FormData();
		fd.set("id", persistedId);
		fd.set("source", source);
		fd.set("name", name);
		fd.set("ico", icoInput.trim());
		if (dic.trim()) {
			fd.set("dic", dic.trim());
		}
		fd.set("street", street);
		fd.set("city", city);
		fd.set("zip", zip);
		fd.set("country", country.trim() || "CZ");
		fd.set("contactEmail", contactEmail.trim());
		fd.set("accountNumber", accountNumber.trim());
		fd.set("iban", iban.trim());
		if (bic.trim()) {
			fd.set("bic", bic.trim());
		}
		fd.set("vatPayer", vatPayer ? "true" : "false");
		if (registryNote.trim()) {
			fd.set("registryNote", registryNote.trim());
		}
		if (logoUrl.trim()) {
			fd.set("logoUrl", logoUrl.trim());
		}
		if (stampUrl.trim()) {
			fd.set("stampUrl", stampUrl.trim());
		}
		if (signatureUrl.trim()) {
			fd.set("signatureUrl", signatureUrl.trim());
		}
		for (const s of schemeState) {
			fd.set(`scheme_${s.docType}_template`, s.template);
			fd.set(`scheme_${s.docType}_resetPeriod`, s.resetPeriod);
			fd.set(`scheme_${s.docType}_counter`, String(s.counter));
			fd.set(`scheme_${s.docType}_padding`, String(s.padding));
			if (s.resetPeriod === "yearly" && s.counterYear != null) {
				fd.set(`scheme_${s.docType}_counterYear`, String(s.counterYear));
			}
		}
		await saveIssuer(fd);
	}

	const userMsg =
		lookupMsg ?? lookupMessageFromInvalid(invalidQuery ?? undefined);

	return (
		<form className="mx-auto max-w-2xl space-y-8" onSubmit={onSubmit}>
			{userMsg ? (
				<p className="text-destructive text-sm">{userMsg}</p>
			) : null}

			<section className="space-y-4">
				<h2 className="text-lg font-medium">Identita</h2>
				<div className="space-y-2">
					<Label>IČO (ARES)</Label>
					<div className="flex flex-wrap gap-2">
						<Input
							className="max-w-xs"
							inputMode="numeric"
							maxLength={8}
							onChange={(ev) => {
								setIcoInput(ev.target.value);
							}}
							pattern="\d{0,8}"
							placeholder="12345678"
							required
							value={icoInput}
						/>
						<Button
							onClick={() => void onLookupFromAres()}
							type="button"
							variant="secondary"
						>
							Lookup
						</Button>
					</div>
				</div>

				<FieldGroup label="Název">
					<Input
						onChange={(ev) => {
							setName(ev.target.value);
						}}
						required
						value={name}
					/>
				</FieldGroup>

				<FieldGroup label="DIČ">
					<Input
						onChange={(ev) => {
							setDic(ev.target.value);
						}}
						placeholder="CZ12345678"
						value={dic}
					/>
				</FieldGroup>

				<div className="grid gap-4 sm:grid-cols-2">
					<FieldGroup label="Ulice a číslo">
						<Input
							onChange={(ev) => {
								setStreet(ev.target.value);
							}}
							required
							value={street}
						/>
					</FieldGroup>
					<FieldGroup label="Město">
						<Input
							onChange={(ev) => {
								setCity(ev.target.value);
							}}
							required
							value={city}
						/>
					</FieldGroup>
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<FieldGroup label="PSČ">
						<Input
							onChange={(ev) => {
								setZip(ev.target.value);
							}}
							required
							value={zip}
						/>
					</FieldGroup>
					<FieldGroup label="Stát (ISO)">
						<Input
							maxLength={2}
							onChange={(ev) => {
								setCountry(ev.target.value.toUpperCase());
							}}
							required
							value={country}
						/>
					</FieldGroup>
				</div>

				<FieldGroup label="Kontaktní e-mail">
					<Input
						onChange={(ev) => {
							setContactEmail(ev.target.value);
						}}
						required
						type="email"
						value={contactEmail}
					/>
				</FieldGroup>

				<label className="flex items-center gap-2 text-sm">
					<input
						checked={vatPayer}
						onChange={(ev) => {
							setVatPayer(ev.target.checked);
						}}
						type="checkbox"
					/>
					Plátce DPH
				</label>

				<FieldGroup label="Zápis v OR (volitelné)">
					<Input
						onChange={(ev) => {
							setRegistryNote(ev.target.value);
						}}
						value={registryNote}
					/>
				</FieldGroup>
			</section>

			<section className="space-y-4">
				<h2 className="text-lg font-medium">Banka</h2>
				<FieldGroup label="Číslo účtu (např. 123456789/0100)">
					<Input
						onChange={(ev) => {
							setAccountNumber(ev.target.value);
						}}
						required
						value={accountNumber}
					/>
				</FieldGroup>
				<FieldGroup label="IBAN">
					<Input
						onChange={(ev) => {
							setIban(ev.target.value);
						}}
						required
						value={iban}
					/>
				</FieldGroup>
				<FieldGroup label="BIC (volitelné)">
					<Input
						onChange={(ev) => {
							setBic(ev.target.value);
						}}
						value={bic}
					/>
				</FieldGroup>
			</section>

			<section className="space-y-4">
				<h2 className="text-lg font-medium">Assety (PDF)</h2>
				{!uploadConfigured ? (
					<p className="text-muted-foreground text-xs">
						UploadThing není nakonfigurován (`UPLOADTHING_TOKEN`) — vložte URL
						ručně, nebo nastavte token.
					</p>
				) : null}
				<AssetField
					label="Logo URL"
					onUrl={setLogoUrl}
					endpoint="issuerLogo"
					uploadConfigured={uploadConfigured}
					url={logoUrl}
				/>
				<AssetField
					label="Razítko URL"
					onUrl={setStampUrl}
					endpoint="issuerStamp"
					uploadConfigured={uploadConfigured}
					url={stampUrl}
				/>
				<AssetField
					label="Podpis URL"
					onUrl={setSignatureUrl}
					endpoint="issuerSignature"
					uploadConfigured={uploadConfigured}
					url={signatureUrl}
				/>
			</section>

			<section className="space-y-4">
				<h2 className="text-lg font-medium">Číslování</h2>
				<p className="text-muted-foreground text-xs">
					Tokeny: {"{YYYY}"} {"{YY}"} {"{MM}"} {"{DD}"} {"{####}"} {"{ISSUER}"}{" "}
					{"{TYPE}"}. Ruční změna counteru může vytvořit mezery v řadě.
				</p>
				{schemeState.map((s, idx) => {
					const label =
						DOC_TYPES.find((d) => d.key === s.docType)?.label ?? s.docType;
					const initialCounter =
						schemes?.find((x) => x.docType === s.docType)?.counter ?? 0;
					let nextPreview = "—";
					try {
						nextPreview = nextInvoiceNumber(
							{
								template: s.template,
								counter: s.counter,
								counterYear: s.counterYear ?? undefined,
								resetPeriod: s.resetPeriod,
								padding: s.padding,
								docType: s.docType,
								issuerName: name || "Issuer",
							},
							new Date(),
						);
					} catch {
						nextPreview = "(neplatná šablona)";
					}
					return (
						<div className="space-y-2 rounded-md border p-3" key={s.docType}>
							<div className="flex flex-wrap items-baseline justify-between gap-2">
								<p className="font-medium text-sm">{label}</p>
								<p className="text-muted-foreground text-xs tabular-nums">
									Další číslo:{" "}
									<span className="text-foreground font-medium">
										{nextPreview}
									</span>
								</p>
							</div>
							{s.counter !== initialCounter ? (
								<p className="text-amber-700 dark:text-amber-400 text-xs">
									Counter byl změněn — zkontrolujte, že nevzniknou duplicity
									nebo mezery.
								</p>
							) : null}
							<div className="grid gap-3 sm:grid-cols-2">
								<FieldGroup label="Šablona">
									<Input
										onChange={(ev) => {
											setSchemeState((prev) => {
												const next = [...prev];
												const cur = next[idx];
												if (!cur) {
													return prev;
												}
												next[idx] = { ...cur, template: ev.target.value };
												return next;
											});
										}}
										value={s.template}
									/>
								</FieldGroup>
								<FieldGroup label="Padding (#)">
									<Input
										min={1}
										max={10}
										onChange={(ev) => {
											const n = Number(ev.target.value);
											setSchemeState((prev) => {
												const next = [...prev];
												const cur = next[idx];
												if (!cur) {
													return prev;
												}
												next[idx] = {
													...cur,
													padding: Number.isFinite(n) ? n : 4,
												};
												return next;
											});
										}}
										type="number"
										value={s.padding}
									/>
								</FieldGroup>
								<FieldGroup label="Reset">
									<select
										className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
										onChange={(ev) => {
											const v =
												ev.target.value === "never" ? "never" : "yearly";
											setSchemeState((prev) => {
												const next = [...prev];
												const cur = next[idx];
												if (!cur) {
													return prev;
												}
												next[idx] = { ...cur, resetPeriod: v };
												return next;
											});
										}}
										value={s.resetPeriod}
									>
										<option value="yearly">Roční</option>
										<option value="never">Nikdy</option>
									</select>
								</FieldGroup>
								<FieldGroup label="Counter">
									<Input
										min={0}
										onChange={(ev) => {
											const n = Number(ev.target.value);
											setSchemeState((prev) => {
												const next = [...prev];
												const cur = next[idx];
												if (!cur) {
													return prev;
												}
												next[idx] = {
													...cur,
													counter: Number.isFinite(n) ? n : 0,
												};
												return next;
											});
										}}
										type="number"
										value={s.counter}
									/>
								</FieldGroup>
								{s.resetPeriod === "yearly" ? (
									<FieldGroup label="Counter year">
										<Input
											onChange={(ev) => {
												const n = Number(ev.target.value);
												setSchemeState((prev) => {
													const next = [...prev];
													const cur = next[idx];
													if (!cur) {
														return prev;
													}
													next[idx] = {
														...cur,
														counterYear: Number.isFinite(n) ? n : yearNow,
													};
													return next;
												});
											}}
											type="number"
											value={s.counterYear ?? yearNow}
										/>
									</FieldGroup>
								) : null}
							</div>
						</div>
					);
				})}
			</section>

			<div className="flex gap-2">
				<Button type="submit">Save</Button>
				<span className="text-muted-foreground flex items-center text-xs">
					Zdroj: {source === "ares" ? "ARES" : "Ručně"}
				</span>
			</div>
		</form>
	);
}

function AssetField(props: {
	label: string;
	url: string;
	onUrl: (v: string) => void;
	endpoint: "issuerLogo" | "issuerStamp" | "issuerSignature";
	uploadConfigured: boolean;
}) {
	return (
		<div className="space-y-2">
			<Label>{props.label}</Label>
			<Input
				onChange={(ev) => {
					props.onUrl(ev.target.value);
				}}
				placeholder="https://…"
				type="url"
				value={props.url}
			/>
			{props.uploadConfigured ? (
				<UploadButton
					endpoint={props.endpoint}
					onClientUploadComplete={(res) => {
						const first = res[0];
						const url =
							(first?.serverData as { url?: string } | undefined)?.url ??
							first?.ufsUrl ??
							first?.url;
						if (typeof url === "string" && url.length > 0) {
							props.onUrl(url);
						}
					}}
					onUploadError={(err) => {
						console.error(err);
					}}
				/>
			) : null}
		</div>
	);
}

function FieldGroup(props: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2">
			<Label>{props.label}</Label>
			{props.children}
		</div>
	);
}

function lookupMessageFromInvalid(inv: string | null | undefined): string | null {
	if (!inv) {
		return null;
	}
	const map: Record<string, string> = {
		required_fields: "Vyplňte povinná pole.",
		bad_ico: "Neplatné IČO.",
		bad_dic: "Neplatné DIČ.",
		bad_bank: "Neplatný účet / IBAN.",
		snapshot_validation: "Údaje neodpovídají schématu vystavovatele.",
		missing_row: "Záznam nenalezen.",
		has_invoices: "Nelze smazat — existují faktury tohoto vystavovatele.",
	};
	return map[inv] ?? `Chyba: ${inv}`;
}

function aresErrorHuman(payload: unknown): string {
	if (!payload || typeof payload !== "object") {
		return "ARES nevrátila data.";
	}
	const maybe = payload as { message?: unknown };
	if (typeof maybe.message === "string") {
		return maybe.message;
	}
	return "Vyhledání v ARES se nezdařilo.";
}
