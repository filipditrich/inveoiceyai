"use client";

import { InvoicePdfPreview } from "@/components/invoices/invoice-pdf-preview";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Invoice } from "@invoicey/invoice-core/schema";
import { InvoiceSchema } from "@invoicey/invoice-core/schema";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

type Balance = {
  giftedRemaining: number;
  monthlyRemaining: number;
  monthlyLimit: number;
  purchasedRemaining: number;
  totalAvailable: number;
  daysUntilRenewal: number;
};

type GenerateResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  text?: string;
  invoice?: {
    invoiceId: string | null;
    invoice: unknown;
    number: string;
    total: number;
    currency: string;
    clientName: string;
  } | null;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    debited: number;
  };
  balance?: Balance;
};

function formatTokens(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return String(n);
}

export function InvoiceAiDraftClient({
  initialBalance,
}: {
  initialBalance: Balance;
}) {
  const t = useTranslations("Invoices.ai");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assistantText, setAssistantText] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [balance, setBalance] = useState(initialBalance);
  const [lastUsage, setLastUsage] = useState<GenerateResponse["usage"] | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const renderPdf = useCallback(async (payload: Invoice) => {
    const res = await fetch("/api/demo/invoice-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`PDF preview failed (${res.status})`);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }, []);

  async function onGenerate() {
    if (busy || !prompt.trim()) return;
    if (balance.totalAvailable <= 0) {
      setError(t("outOfTokens"));
      return;
    }
    setBusy(true);
    setError(null);
    setAssistantText(null);
    try {
      const res = await fetch("/api/ai/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = (await res.json()) as GenerateResponse;
      if (data.balance) setBalance(data.balance);
      if (data.usage) setLastUsage(data.usage);

      if (data.invoice?.invoice) {
        const parsed = InvoiceSchema.safeParse(data.invoice.invoice);
        if (parsed.success) {
          setInvoice(parsed.data);
          setInvoiceId(data.invoice.invoiceId);
          const prev = pdfUrl;
          const next = await renderPdf(parsed.data);
          setPdfUrl(next);
          if (prev) URL.revokeObjectURL(prev);
        } else if (res.ok) {
          setError(t("invalidDraft"));
        }
      } else if (res.ok) {
        setInvoice(null);
        setInvoiceId(null);
      }

      if (data.text) setAssistantText(data.text);

      if (!res.ok) {
        setError(
          data.error === "out_of_ai_tokens"
            ? t("outOfTokens")
            : (data.message ?? data.error ?? t("errorGeneric")),
        );
        return;
      }
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  const outOfTokens = balance.totalAvailable <= 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span>
            {t("tokensAvailable", {
              available: formatTokens(balance.totalAvailable),
            })}
          </span>
          <Link
            href="/settings/usage"
            className="text-foreground underline-offset-4 hover:underline"
          >
            {t("viewUsage")}
          </Link>
        </div>

        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t("placeholder")}
          rows={8}
          disabled={busy || outOfTokens}
          className="min-h-40 font-sans"
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={busy || outOfTokens || !prompt.trim()}
            onClick={() => void onGenerate()}
          >
            {busy ? t("generating") : t("generate")}
          </Button>
          {lastUsage ? (
            <span className="text-muted-foreground text-xs">
              {t("lastUsage", {
                tokens: formatTokens(lastUsage.totalTokens),
              })}
            </span>
          ) : null}
        </div>

        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}{" "}
            {outOfTokens || error === t("outOfTokens") ? (
              <Link
                href="/settings/usage"
                className="underline underline-offset-4"
              >
                {t("viewUsage")}
              </Link>
            ) : null}
          </p>
        ) : null}

        {assistantText ? (
          <div className="bg-muted/40 whitespace-pre-wrap rounded-lg border p-4 text-sm">
            {assistantText}
          </div>
        ) : null}

        {invoice && invoiceId ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/invoices/${invoiceId}`}
              className={cn(buttonVariants({ variant: "default" }))}
            >
              {t("openDraft")}
            </Link>
            <Link
              href={`/invoices/${invoiceId}/edit`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              {t("editInBuilder")}
            </Link>
          </div>
        ) : null}
      </div>

      <div>
        <InvoicePdfPreview
          url={pdfUrl}
          emptyLabel={t("previewEmpty")}
          updating={busy}
        />
      </div>
    </div>
  );
}
