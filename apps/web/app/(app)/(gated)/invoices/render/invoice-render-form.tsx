"use client";

import { useCallback, useState } from "react";
import { InvoiceJsonEditor } from "@/components/invoices/invoice-json-editor";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import sampleBatch from "@/lib/invoice-render-sample.json";
import { cn } from "@/lib/utils";
import { FileDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { InvoiceSchema } from "@invoicey/invoice-core/schema";

const formattedSample = JSON.stringify(
  {
    invoices: sampleBatch.invoices.map((invoice) =>
      InvoiceSchema.parse(invoice),
    ),
  },
  null,
  2,
);

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function filenameFromDisposition(
  header: string | null,
  fallback: string,
): string {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

export function InvoiceRenderForm() {
  const t = useTranslations("Invoices.render");
  const [text, setText] = useState(formattedSample);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(async () => {
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

    const res = await fetch("/api/render/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });

    if (!res.ok) {
      try {
        const payload: unknown = await res.json();
        setError(JSON.stringify(payload, null, 2));
      } catch {
        setError(`${res.status} ${res.statusText}`);
      }
      setBusy(false);
      return;
    }

    const blob = await res.blob();
    const fallback = blob.type.includes("zip") ? "invoices.zip" : "invoice.pdf";
    downloadBlob(
      blob,
      filenameFromDisposition(res.headers.get("content-disposition"), fallback),
    );
    setBusy(false);
  }, [t, text]);

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
        icon={<FileDownIcon />}
        title={t("title")}
      />

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm">
        <p className="text-sm font-medium">{t("jsonLabel")}</p>
        <InvoiceJsonEditor
          disabled={busy}
          id="invoice-render-json"
          label={t("jsonLabel")}
          onChange={setText}
          value={text}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={() => void download()}>
            {busy ? t("rendering") : t("download")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setText(formattedSample)}
          >
            {t("resetSample")}
          </Button>
        </div>
        {error ? (
          <pre className="max-h-64 overflow-auto rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs whitespace-pre-wrap text-destructive">
            {error}
          </pre>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("help")}
          </p>
        )}
      </div>
    </div>
  );
}
