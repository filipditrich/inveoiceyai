"use client";

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
		<div className="space-y-6">
			<div className="flex flex-wrap items-baseline gap-3">
				<h1 className="text-2xl font-semibold">Invoice from JSON</h1>
				<p className="text-muted-foreground text-sm">
					Phase 3 demo: paste an <code className="text-foreground">InvoiceSchema</code>{" "}
					payload and preview the rendered PDF on the server.
				</p>
			</div>
			<p className="text-sm">
				<Link href="/invoices" className="text-primary underline underline-offset-4">
					← Back to Invoices
				</Link>
			</p>

			<div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
				<div className="flex w-full shrink-0 flex-col gap-3 xl:max-w-md xl:overflow-hidden">
					<label htmlFor="invoice-json" className="text-sm font-medium">
						Invoice JSON
					</label>
					<textarea
						id="invoice-json"
						value={text}
						onChange={(event) => setText(event.target.value)}
						spellCheck={false}
						className="border-input placeholder:text-muted-foreground focus-visible:ring-ring max-h-[40vh] min-h-56 w-full resize-y rounded-md border bg-transparent px-3 py-2 font-mono text-sm shadow-xs focus-visible:ring-2 focus-visible:outline-none xl:max-h-[min(42vh,28rem)]"
						placeholder="{}"
						autoComplete="off"
					/>
					<div className="flex flex-wrap gap-2">
						<select
							value={selectedExampleId}
							onChange={(event) => setSelectedExampleId(event.target.value)}
							className="border-input bg-background text-foreground inline-flex min-w-68 rounded-md border px-3 py-2 text-sm"
						>
							{demoInvoiceExamples.map((example) => (
								<option key={example.id} value={example.id}>
									{example.label}
								</option>
							))}
						</select>
						<button
							type="button"
							disabled={busy}
							onClick={loadSelectedExample}
							className="border-input hover:bg-accent inline-flex cursor-pointer rounded-md border px-4 py-2 text-sm disabled:opacity-50"
						>
							Load selected example
						</button>
						<button
							type="button"
							onClick={() => void renderPdf()}
							disabled={busy}
							className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex cursor-pointer rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
						>
							{busy ? "Rendering…" : "Render PDF"}
						</button>
						<button
							type="button"
							disabled={busy}
							onClick={() => setText(formatSampleJson(baseDemoInvoice))}
							className="border-input hover:bg-accent inline-flex cursor-pointer rounded-md border px-4 py-2 text-sm disabled:opacity-50"
						>
							Load base sample
						</button>
					</div>
					{error ? (
						<pre className="bg-destructive/10 border-destructive/30 text-destructive max-h-48 overflow-auto rounded-md border p-3 text-xs whitespace-pre-wrap">
							{error}
						</pre>
					) : (
						<p className="text-muted-foreground text-xs">
							Validated with <code>InvoiceSchema.parse</code> inside{" "}
							<code>/api/demo/invoice-pdf</code>. See{" "}
							<code>@invoicey/invoice-core</code> fixtures and demo presets for
							more examples.
						</p>
					)}
				</div>

				<div className="flex min-h-0 flex-1 flex-col gap-2">
					<span className="text-sm font-medium">Preview</span>
					{pdfUrl ? (
						<iframe
							title="Invoice PDF preview"
							src={`${pdfUrl}#toolbar=1`}
							className="bg-muted border-input block min-h-[min(88vh,52rem)] w-full flex-1 rounded-md border"
						/>
					) : (
						<div className="bg-muted/50 border-input text-muted-foreground flex min-h-[min(88vh,52rem)] flex-1 items-center justify-center rounded-md border border-dashed text-sm">
							Run &quot;Render PDF&quot; to see the invoice here.
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
