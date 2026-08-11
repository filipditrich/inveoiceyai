"use client";

import {
  CheckIcon,
  CornerDownLeftIcon,
  QrCodeIcon,
  ReceiptTextIcon,
  SparklesIcon,
} from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useRef, useState } from "react";

import styles from "./marketing-motion.module.css";

type InvoiceExample = {
  label: string;
  prompt: string;
  customer: string;
  companyId: string;
  service: string;
  baseAmount: number;
  vatRate: number;
  dueDays: number;
};

const EXAMPLES = [
  {
    label: "Měsíční služby",
    prompt:
      "Vystav fakturu pro Studio Sever za měsíční služby, 35 000 Kč bez DPH, splatnost 14 dní.",
    customer: "Studio Sever",
    companyId: "IČO 087 54 321 · ARES ověřeno",
    service: "Měsíční služby",
    baseAmount: 35_000,
    vatRate: 0,
    dueDays: 14,
  },
  {
    label: "Webdesign",
    prompt:
      "Vystav fakturu pro Ateliér 21 za návrh webu, 48 000 Kč + DPH, splatnost 10 dní.",
    customer: "Ateliér 21",
    companyId: "IČO 142 68 095 · ARES ověřeno",
    service: "Návrh webu",
    baseAmount: 48_000,
    vatRate: 21,
    dueDays: 10,
  },
  {
    label: "Konzultace",
    prompt:
      "Vystav fakturu pro Kavárnu Místo za konzultace, 18 500 Kč + DPH, splatnost 7 dní.",
    customer: "Kavárna Místo",
    companyId: "IČO 062 19 483 · ARES ověřeno",
    service: "Produktové konzultace",
    baseAmount: 18_500,
    vatRate: 21,
    dueDays: 7,
  },
] as const satisfies readonly InvoiceExample[];

const AMOUNT_PATTERN = /(\d[\d\s]*(?:[.,]\d+)?)\s*(?:Kč|CZK)/i;
const DUE_PATTERN = /(\d+)\s*(?:dní|dnů|dny)/i;

function parseAmount(value: string) {
  return Number.parseFloat(value.replaceAll(" ", "").replace(",", "."));
}

export function ProductPreview() {
  const [prompt, setPrompt] = useState<string>(EXAMPLES[0].prompt);
  const [invoice, setInvoice] = useState<InvoiceExample>(EXAMPLES[0]);
  const [revision, setRevision] = useState(0);
  const [hasUpdated, setHasUpdated] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const chooseExample = (example: InvoiceExample) => {
    setPrompt(example.prompt);
    setInvoice(example);
    setRevision((current) => current + 1);
    setHasUpdated(true);
  };

  const updatePreview = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const activePrompt = promptRef.current?.value ?? prompt;
    const normalizedPrompt = activePrompt.replaceAll(" ", " ");
    const amountMatch = normalizedPrompt.match(AMOUNT_PATTERN);
    const dueMatch = normalizedPrompt.match(DUE_PATTERN);
    const matchedExample = EXAMPLES.find((example) =>
      normalizedPrompt
        .toLocaleLowerCase("cs")
        .includes(example.customer.toLocaleLowerCase("cs")),
    );
    const basis = matchedExample ?? invoice;
    const parsedAmount = amountMatch
      ? parseAmount(amountMatch[1])
      : basis.baseAmount;
    const hasVat = /(?:\+\s*DPH|s\s+DPH)/i.test(normalizedPrompt);
    const noVat = /bez\s+DPH/i.test(normalizedPrompt);

    setInvoice({
      ...basis,
      prompt: activePrompt,
      baseAmount: Number.isFinite(parsedAmount)
        ? parsedAmount
        : basis.baseAmount,
      vatRate: noVat ? 0 : hasVat ? 21 : basis.vatRate,
      dueDays: dueMatch ? Number.parseInt(dueMatch[1], 10) : basis.dueDays,
    });
    setRevision((current) => current + 1);
    setHasUpdated(true);
  };

  const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const totalAmount = invoice.baseAmount * (1 + invoice.vatRate / 100);
  const formatAmount = (amount: number) =>
    new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(amount);

  return (
    <div
      className={`${styles.heroDemo} relative mx-auto w-full max-w-2xl lg:max-w-none`}
    >
      <div className="from-brand/25 bg-radial absolute -inset-8 -z-10 rounded-[3rem] to-transparent blur-2xl" />
      <div
        className={`${styles.productStage} relative min-h-[42rem] overflow-hidden rounded-[1.75rem] border p-3 shadow-2xl sm:min-h-[36rem] sm:p-5`}
      >
        <form
          onSubmit={updatePreview}
          className={`${styles.promptCard} bg-background/92 relative z-20 rounded-2xl border p-4 shadow-xl backdrop-blur-xl`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-primary flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.15em]">
              <SparklesIcon className="size-3.5" />
              Zadejte fakturu přirozeně
            </div>
            <span className="text-muted-foreground hidden text-[0.6rem] sm:block">
              Enter pro aktualizaci
            </span>
          </div>
          <textarea
            ref={promptRef}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={submitOnEnter}
            rows={2}
            className="placeholder:text-muted-foreground/60 mt-3 w-full resize-none bg-transparent text-sm leading-6 outline-none"
            aria-label="Pokyn pro vytvoření faktury"
          />
          <div className="mt-3 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  onClick={() => chooseExample(example)}
                  className="bg-muted/65 hover:border-primary/35 hover:text-primary rounded-full border border-transparent px-2.5 py-1 text-[0.62rem] font-medium transition-[color,border-color,background-color,transform] duration-200 hover:-translate-y-0.5"
                >
                  {example.label}
                </button>
              ))}
            </div>
            <button
              type="submit"
              className="bg-foreground text-background hover:bg-primary hover:text-primary-foreground group inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-3.5 py-2 text-[0.68rem] font-medium transition-colors"
            >
              Připravit náhled
              <CornerDownLeftIcon className="size-3.5 transition-transform duration-200 group-hover:translate-y-0.5" />
            </button>
          </div>
          <p
            className={`mt-2 text-[0.62rem] font-medium text-emerald-700 transition-opacity dark:text-emerald-300 ${hasUpdated ? "opacity-100" : "opacity-0"}`}
            aria-live="polite"
          >
            Náhled aktualizován · povinné údaje ověřeny
          </p>
        </form>

        <div
          key={revision}
          className={`${styles.invoicePaper} ${styles.invoiceRefresh} bg-card absolute inset-x-5 bottom-[-3rem] top-[16.25rem] rounded-t-[1.4rem] border p-5 shadow-2xl sm:inset-x-10 sm:top-[15rem] sm:p-6`}
        >
          <div className="flex items-start justify-between border-b pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-foreground text-background grid size-8 place-items-center rounded-lg">
                  <ReceiptTextIcon className="size-4" strokeWidth={1.7} />
                </span>
                <span className="text-sm font-semibold">Invoicey</span>
              </div>
              <p className="text-muted-foreground mt-4 text-[0.55rem] font-medium uppercase tracking-[0.18em]">
                Dodavatel
              </p>
              <p className="mt-1 text-xs font-medium">Ditrich Labs</p>
              <p className="text-muted-foreground mt-0.5 text-[0.62rem]">
                IČO 123 45 678
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold tracking-tight">Faktura</p>
              <p className="text-muted-foreground mt-1 font-mono text-[0.62rem]">
                2026-0048
              </p>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-1 text-[0.58rem] font-medium text-emerald-700 dark:text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Připraveno
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5 border-b py-4">
            <div>
              <p className="text-muted-foreground text-[0.55rem] font-medium uppercase tracking-[0.16em]">
                Odběratel
              </p>
              <p className="mt-1 text-xs font-medium">{invoice.customer}</p>
              <p className="text-muted-foreground mt-0.5 text-[0.6rem]">
                {invoice.companyId}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-[0.55rem] font-medium uppercase tracking-[0.16em]">
                Splatnost
              </p>
              <p className="mt-1 text-xs font-medium">{invoice.dueDays} dní</p>
              <p className="text-muted-foreground mt-0.5 text-[0.6rem]">
                {invoice.vatRate > 0 ? `DPH ${invoice.vatRate} %` : "Bez DPH"}
              </p>
            </div>
          </div>

          <div className="py-4">
            <div className="text-muted-foreground grid grid-cols-[1fr_auto] gap-4 text-[0.55rem] font-medium uppercase tracking-[0.14em]">
              <span>Položka</span>
              <span>Částka</span>
            </div>
            <div className="mt-2.5 grid grid-cols-[1fr_auto] gap-4 text-xs">
              <p className="font-medium">{invoice.service}</p>
              <p className="font-mono font-medium">
                {formatAmount(invoice.baseAmount)} Kč
              </p>
            </div>
          </div>

          <div className="flex items-end justify-between border-t pt-4">
            <div className="flex items-center gap-2.5">
              <span className="bg-background grid size-11 place-items-center rounded-lg border">
                <QrCodeIcon className="size-8" strokeWidth={1.5} />
              </span>
              <div className="hidden sm:block">
                <p className="text-muted-foreground text-[0.55rem] font-medium uppercase tracking-[0.14em]">
                  SPAYD
                </p>
                <p className="mt-0.5 text-[0.6rem]">Platba mobilem</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-[0.55rem] font-medium uppercase tracking-[0.16em]">
                Celkem
              </p>
              <p className="mt-0.5 text-xl font-semibold tracking-tight">
                {formatAmount(totalAmount)} Kč
              </p>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 right-4 z-20 flex gap-2 sm:right-7">
          {["PDF", "ISDOC"].map((format) => (
            <span
              key={format}
              className="bg-background/92 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[0.58rem] font-medium shadow-lg backdrop-blur"
            >
              {format} <CheckIcon className="size-3 text-emerald-600" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
