"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import demoSampleInvoice from "@/lib/demo-sample-invoice.json";
import { demoInvoiceExamples } from "@/lib/demo-invoice-examples";
import { InvoiceSchema, type Invoice } from "@invoicey/invoice-core/schema";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function formatSampleJson(sample: Invoice): string {
	return JSON.stringify(sample, null, 2);
}

const baseDemoInvoice = InvoiceSchema.parse(demoSampleInvoice);

export default function InvoiceFromJsonDemoPage() {
	const [text, setText] = useState(() => formatSampleJson(baseDemoInvoice));
	const [selectedExampleId, setSelectedExampleId] = useState(
		demoInvoiceExamples[0]?.id ?? "",
	);
	const [pdfUrl, setPdfUrl] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		return () => {
			if (pdfUrl) {
				URL.revokeObjectURL(pdfUrl);
			}
		};
	}, [pdfUrl]);

	const renderPdf = useCallback(async () => {
		setBusy(true);
		setError(null);
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			setError("Could not parse JSON: fix syntax errors and try again.");
			setBusy(false);
			return;
		}

		const res = await fetch("/api/demo/invoice-pdf", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(parsed),
		});

		const prev = pdfUrl;
		if (!res.ok) {
			let message = `${res.status} ${res.statusText}`;
			try {
				const payload = await res.json();
				const err = typeof payload?.error === "string" ? payload.error : "";
				const flat = payload?.issues;
				if (err) {
					message = err;
					if (
						res.status === 422
						&& flat
						&& typeof flat === "object"
						&& "fieldErrors" in flat
						&& flat.fieldErrors != null
					) {
						message += ` — ${JSON.stringify(flat.fieldErrors)}`;
					}
				}
			} catch {
				try {
					const t = await res.text();
					if (t?.length && t.length < 500) message = t;
				} catch {
					/** keep defaults */
				}
			}
			setError(message);
			if (prev) {
				URL.revokeObjectURL(prev);
			}
			setPdfUrl(null);
			setBusy(false);
			return;
		}

		const blob = await res.blob();
		if (prev) {
			URL.revokeObjectURL(prev);
		}
		setPdfUrl(URL.createObjectURL(blob));
		setBusy(false);
	}, [pdfUrl, text]);

	const loadSelectedExample = useCallback(() => {
		const selected = demoInvoiceExamples.find(
			(example) => example.id === selectedExampleId,
		);
		if (!selected) {
			return;
		}
		setText(formatSampleJson(selected.invoice));
		setError(null);
	}, [selectedExampleId]);

	return (
		<div className="space-y-8">
			<div className="border-border bg-card text-card-foreground rounded-xl border px-6 py-5 shadow-sm">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div className="max-w-2xl space-y-1">
						<p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
							Demo · Phase 3
						</p>
						<h1 className="text-balance text-2xl font-semibold tracking-tight md:text-[1.75rem]">
							Invoice from JSON
						</h1>
						<p className="text-muted-foreground leading-relaxed">
							Paste an{" "}
							<code className="bg-muted text-foreground rounded-md px-1.5 py-0.5 font-mono text-xs">
								InvoiceSchema
							</code>{" "}
							payload and render server-side PDF for a quick sanity check.
						</p>
					</div>
					<Link
						href="/invoices"
						className={cn(
							buttonVariants({ variant: "ghost" }),
							"h-auto shrink-0 py-2 text-muted-foreground hover:text-foreground",
						)}
					>
						← Back to Invoices
					</Link>
				</div>
			</div>

			<div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
				<div className="border-border bg-card text-card-foreground flex w-full shrink-0 flex-col gap-4 rounded-xl border p-5 shadow-sm xl:max-w-md xl:p-6">
					<div>
						<label htmlFor="invoice-json" className="mb-2 block text-sm font-medium">
							Invoice JSON
						</label>
						<textarea
							id="invoice-json"
							value={text}
							onChange={(event) => setText(event.target.value)}
							spellCheck={false}
							className="border-input placeholder:text-muted-foreground focus-visible:ring-ring shadow-xs max-h-[40vh] min-h-52 w-full resize-y rounded-lg border bg-transparent px-3 py-2.5 font-mono text-[0.8125rem] leading-relaxed focus-visible:ring-2 focus-visible:outline-none xl:max-h-[min(42vh,28rem)]"
							placeholder="{}"
							autoComplete="off"
						/>
					</div>
					<div className="flex flex-wrap gap-2">
						<select
							value={selectedExampleId}
							onChange={(event) => setSelectedExampleId(event.target.value)}
							className="border-input bg-background text-foreground hover:bg-accent/50 ring-offset-background inline-flex min-w-[min(17rem,100%)] rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
						>
							{demoInvoiceExamples.map((example) => (
								<option key={example.id} value={example.id}>
									{example.label}
								</option>
							))}
						</select>
						<Button type="button" variant="outline" disabled={busy} onClick={loadSelectedExample}>
							Load preset
						</Button>
						<Button type="button" disabled={busy} onClick={() => void renderPdf()}>
							{busy ? "Rendering…" : "Render PDF"}
						</Button>
						<Button
							type="button"
							variant="outline"
							disabled={busy}
							onClick={() => setText(formatSampleJson(baseDemoInvoice))}
						>
							Reset sample
						</Button>
					</div>
					{error ? (
						<pre className="border-destructive/30 bg-destructive/10 text-destructive max-h-48 overflow-auto rounded-lg border px-3 py-2 text-xs whitespace-pre-wrap">
							{error}
						</pre>
					) : (
						<p className="text-muted-foreground text-xs leading-relaxed">
							Parsed via{" "}
							<code className="bg-muted rounded px-1 py-px font-mono text-[0.6875rem]">
								InvoiceSchema
							</code>{" "}
							on{" "}
							<code className="bg-muted rounded px-1 py-px font-mono text-[0.6875rem]">
								/api/demo/invoice-pdf
							</code>
							.
						</p>
					)}
				</div>

				<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
					<div className="flex items-center gap-2">
						<h2 className="text-base font-semibold tracking-tight">Preview</h2>
						<span className="text-muted-foreground text-xs font-normal tabular-nums">
							server-rendered PDF
						</span>
					</div>
					{pdfUrl ? (
						<iframe
							title="Invoice PDF preview"
							src={`${pdfUrl}#toolbar=1`}
							className="border-input bg-muted/40 block min-h-[min(88vh,52rem)] w-full flex-1 rounded-xl border shadow-sm"
						/>
					) : (
						<div className="border-input bg-muted/25 text-muted-foreground flex min-h-[min(88vh,52rem)] flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center text-sm leading-relaxed">
							<span className="text-foreground font-medium">No preview yet</span>
							Run <strong className="font-normal">&quot;Render PDF&quot;</strong> — the iframe embeds the
							returned blob.
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
