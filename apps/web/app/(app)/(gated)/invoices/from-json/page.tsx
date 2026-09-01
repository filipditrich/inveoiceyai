"use client";

import { useCallback, useEffect, useState } from "react";
import { InvoicePdfPreview } from "@/components/invoices/invoice-pdf-preview";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { demoInvoiceExamples } from "@/lib/demo-invoice-examples";
import demoSampleInvoice from "@/lib/demo-sample-invoice.json";
import { cn } from "@/lib/utils";
import { BracesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { InvoiceSchema, type Invoice } from "@invoicey/invoice-core/schema";

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
              "h-auto shrink-0 py-2 text-muted-foreground hover:text-foreground",
            )}
          >
            {t("backToInvoices")}
          </Link>
        }
        description={t.rich("subtitle", {
          code: (chunks) => (
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              {chunks}
            </code>
          ),
        })}
        eyebrow={t("eyebrow")}
        icon={<BracesIcon />}
        title={t("title")}
      />

      <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
        <div className="flex w-full shrink-0 flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm xl:max-w-md xl:p-6">
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
              className="max-h-[40vh] min-h-52 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2.5 font-mono text-[0.8125rem] leading-relaxed shadow-xs placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none xl:max-h-[min(42vh,28rem)]"
              placeholder="{}"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={selectedExampleId}
              onChange={(event) => setSelectedExampleId(event.target.value)}
              className="inline-flex min-w-[min(17rem,100%)] rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background transition-colors outline-none hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
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
            <pre className="max-h-48 overflow-auto rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs whitespace-pre-wrap text-destructive">
              {error}
            </pre>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
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
