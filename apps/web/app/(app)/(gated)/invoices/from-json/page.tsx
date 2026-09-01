"use client";

import { InvoicePdfPreview } from "@/components/invoices/invoice-pdf-preview";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import demoSampleInvoice from "@/lib/demo-sample-invoice.json";
import { demoInvoiceExamples } from "@/lib/demo-invoice-examples";
import { InvoiceSchema, type Invoice } from "@invoicey/invoice-core/schema";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { BracesIcon } from "lucide-react";

function formatSampleJson(sample: Invoice): string {
  return JSON.stringify(sample, null, 2);
}

const baseDemoInvoice = InvoiceSchema.parse(demoSampleInvoice);

export default function InvoiceFromJsonDemoPage() {
  const t = useTranslations("Invoices.fromJson");
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
      setError(t("parseError"));
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
        const detail =
          typeof payload?.detail === "string" ? payload.detail : "";
        const flat = payload?.issues;
        if (err === "invalid_look" && detail) {
          message = detail;
        } else if (err) {
          message = err;
          if (
            res.status === 422 &&
            flat &&
            typeof flat === "object" &&
            "fieldErrors" in flat &&
            flat.fieldErrors != null
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
  }, [pdfUrl, t, text]);

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
      <PageHeader
        actions={
          <Link
            href="/invoices"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "text-muted-foreground hover:text-foreground h-auto shrink-0 py-2",
            )}
          >
            {t("backToInvoices")}
          </Link>
        }
        description={t.rich("subtitle", {
          code: (chunks) => (
            <code className="bg-muted text-foreground rounded-md px-1.5 py-0.5 font-mono text-xs">
              {chunks}
            </code>
          ),
        })}
        eyebrow={t("eyebrow")}
        icon={<BracesIcon />}
        title={t("title")}
      />

      <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
        <div className="border-border bg-card text-card-foreground flex w-full shrink-0 flex-col gap-4 rounded-xl border p-5 shadow-sm xl:max-w-md xl:p-6">
          <div>
            <label
              htmlFor="invoice-json"
              className="mb-2 block text-sm font-medium"
            >
              {t("jsonLabel")}
            </label>
            <textarea
              id="invoice-json"
              value={text}
              onChange={(event) => setText(event.target.value)}
              spellCheck={false}
              className="border-input placeholder:text-muted-foreground focus-visible:ring-ring shadow-xs max-h-[40vh] min-h-52 w-full resize-y rounded-lg border bg-transparent px-3 py-2.5 font-mono text-[0.8125rem] leading-relaxed focus-visible:outline-none focus-visible:ring-2 xl:max-h-[min(42vh,28rem)]"
              placeholder="{}"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedExampleId}
              onChange={(event) => setSelectedExampleId(event.target.value)}
              className="border-input bg-background text-foreground hover:bg-accent/50 ring-offset-background focus-visible:ring-ring inline-flex min-w-[min(17rem,100%)] rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2"
            >
              {demoInvoiceExamples.map((example) => (
                <option key={example.id} value={example.id}>
                  {example.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={loadSelectedExample}
            >
              {t("loadPreset")}
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void renderPdf()}
            >
              {busy ? t("rendering") : t("renderPdf")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setText(formatSampleJson(baseDemoInvoice))}
            >
              {t("resetSample")}
            </Button>
          </div>
          {error ? (
            <pre className="border-destructive/30 bg-destructive/10 text-destructive max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border px-3 py-2 text-xs">
              {error}
            </pre>
          ) : (
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t("validationHelp")}
            </p>
          )}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <InvoicePdfPreview
            emptyLabel={t("emptyPreview")}
            updating={busy}
            url={pdfUrl}
          />
        </div>
      </div>
    </div>
  );
}
