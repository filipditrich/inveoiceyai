"use client";

import * as React from "react";
import { DownloadGate } from "@/components/generator/download-gate";
import { PdfPreviewStub } from "@/components/generator/pdf-preview-stub";
import { useDemoInvoicePreview } from "@/components/generator/use-demo-preview";
import { Field, selectClassName } from "@/components/invoices/field";
import { InvoicePdfPreview } from "@/components/invoices/invoice-pdf-preview";
import { lookupAresByIco } from "@/components/issuers/issuer-form-shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { applyLookEdit } from "@/lib/generator/apply-look-edit";
import {
  applyAresToIssuer,
  applyAresToParty,
  guestDisplayInvoiceFromDraft,
  guestInvoiceFromDraft,
  guestPreviewInvoiceFromDraft,
  parseGeneratorDraftUrl,
  sampleGeneratorDraft,
  withPrefillNumber,
  withVatMode,
  type GeneratorDraft,
} from "@/lib/generator/draft";
import { readGeneratorHandoff } from "@/lib/generator/handoff";
import { appLocaleFrom } from "@/lib/generator/href";
import { generatorIssueKeys } from "@/lib/generator/issue-hints";
import { cn } from "@/lib/utils";
import { DownloadIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Inter } from "next/font/google";
import { debounce, parseAsJson, parseAsString, useQueryState } from "nuqs";

import {
  LookDocumentView,
  renderSpaydQrDataUrl,
  type LookEdit,
} from "@invoicey/invoice-core/look-dom";
import { ACCENT_COLOR_HEX } from "@invoicey/invoice-core/looks";

import type { AppLocale } from "@/i18n/config";

const lookSans = Inter({ subsets: ["latin", "latin-ext"] });

const ACCENT_KEYS = [
  "neutral",
  "blue",
  "green",
  "amber",
  "rose",
  "violet",
] as const;

const draftUrlParser = parseAsJson(parseGeneratorDraftUrl).withOptions({
  history: "replace",
  limitUrlUpdates: debounce(400),
});

function patchDraft(
  setDraft: React.Dispatch<React.SetStateAction<GeneratorDraft | null>>,
  updater: (draft: GeneratorDraft) => GeneratorDraft,
) {
  setDraft((current) =>
    current ? withPrefillNumber(updater(current)) : current,
  );
}

function useGeneratorDraft(locale: AppLocale) {
  const [icoParam] = useQueryState("ico", parseAsString);
  const [draftUrl, setDraftUrl] = useQueryState("d", draftUrlParser);
  const [draft, setDraft] = React.useState<GeneratorDraft | null>(null);
  const lastIssuerIco = React.useRef("");
  const lastClientIco = React.useRef("");

  React.useEffect(() => {
    if (draft) return;
    const sample = sampleGeneratorDraft({
      issuerId: crypto.randomUUID(),
      clientId: crypto.randomUUID(),
      locale,
    });
    if (draftUrl) {
      lastIssuerIco.current = draftUrl.issuer.ico;
      lastClientIco.current = draftUrl.client.ico;
      setDraft(withPrefillNumber(draftUrl));
      return;
    }
    const fromQuery = (icoParam ?? "").replace(/\D/gu, "").slice(0, 8);
    const handoff = readGeneratorHandoff();
    const issuerIco =
      fromQuery.length === 8 ? fromQuery : (handoff.issuerIco ?? "");
    lastClientIco.current = sample.client.ico;
    if (!issuerIco) {
      lastIssuerIco.current = sample.issuer.ico;
      setDraft(sample);
      return;
    }
    lastIssuerIco.current = "";
    setDraft({
      ...sample,
      issuer: { ...sample.issuer, ico: issuerIco },
    });
  }, [draft, draftUrl, icoParam, locale]);

  React.useEffect(() => {
    if (!draft) return;
    void setDraftUrl(draft);
  }, [draft, setDraftUrl]);

  return { draft, setDraft, lastIssuerIco, lastClientIco };
}

export function GeneratorForm() {
  const t = useTranslations("Generator");
  const locale = appLocaleFrom(useLocale());
  const { draft, setDraft, lastIssuerIco, lastClientIco } =
    useGeneratorDraft(locale);
  const [gateOpen, setGateOpen] = React.useState(false);
  const [pdfOpen, setPdfOpen] = React.useState(false);
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);

  const previewBuild = React.useMemo(() => {
    if (!draft) return { invoice: null, display: null };
    const built = guestPreviewInvoiceFromDraft(draft);
    return {
      invoice: built.ok ? built.invoice : null,
      display: guestDisplayInvoiceFromDraft(draft),
    };
  }, [draft]);

  React.useEffect(() => {
    const invoice = previewBuild.invoice;
    const hasBank = Boolean(
      draft?.issuer.accountNumber.trim() || draft?.issuer.iban.trim(),
    );
    if (!invoice || !draft?.showQr || !hasBank) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void renderSpaydQrDataUrl(invoice).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [
    previewBuild.invoice,
    draft?.showQr,
    draft?.issuer.accountNumber,
    draft?.issuer.iban,
  ]);

  const issuerIco = draft?.issuer.ico ?? "";
  const clientIco = draft?.client.ico ?? "";

  React.useEffect(() => {
    void lookupPartyIco("issuer", issuerIco, lastIssuerIco, setDraft);
  }, [issuerIco, lastIssuerIco, setDraft]);

  React.useEffect(() => {
    void lookupPartyIco("client", clientIco, lastClientIco, setDraft);
  }, [clientIco, lastClientIco, setDraft]);

  const preview = useDemoInvoicePreview({ bakeWatermark: true });

  function onDownload() {
    if (!draft) return;
    const built = guestInvoiceFromDraft(draft);
    if (!built.ok) return;
    setGateOpen(true);
  }

  async function onOpenPdf() {
    setPdfOpen(true);
    await preview.render(previewBuild.invoice);
  }

  function onLookEdit(edit: LookEdit) {
    patchDraft(setDraft, (current) => applyLookEdit(current, edit));
  }

  if (!draft) {
    return <p className="text-sm text-muted-foreground">{t("preview")}</p>;
  }

  const issueInvoice = guestInvoiceFromDraft(draft);
  const vatLocked = !draft.issuer.vatPayer;

  return (
    <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="rounded-full border px-2 py-0.5 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
            {t("sampleBadge")}
          </span>
          <p className="text-sm text-muted-foreground">{t("editorHint")}</p>
        </div>
        <div className="overflow-x-auto rounded-2xl border bg-gradient-to-b from-muted/50 to-muted/20 p-3 shadow-inner sm:p-8">
          {previewBuild.display ? (
            <div
              className={lookSans.className}
              style={{
                boxShadow:
                  "0 18px 50px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.08)",
                maxWidth: "100%",
                width: "max-content",
              }}
            >
              <LookDocumentView
                assets={{ qrDataUrl }}
                invoice={previewBuild.display}
                onEdit={onLookEdit}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("preview")}</p>
          )}
        </div>
      </div>
      <aside className="space-y-6 rounded-2xl border bg-card/60 p-5 xl:sticky xl:top-20 xl:self-start">
        <SettingsPanel
          draft={draft}
          vatLocked={vatLocked}
          onChange={(next) => patchDraft(setDraft, () => next)}
        />
        <div className="space-y-2">
          <Button
            className="h-11 w-full text-[0.95rem]"
            onClick={onDownload}
            size="lg"
            type="button"
          >
            <DownloadIcon />
            {issueInvoice.ok ? t("download") : t("downloadFix")}
          </Button>
          {issueInvoice.ok ? null : (
            <IssueHints message={issueInvoice.message} />
          )}
        </div>
        <div className="space-y-3">
          <PdfPreviewStub
            busy={preview.updating}
            onOpen={() => void onOpenPdf()}
          />
        </div>
      </aside>
      <DownloadGate
        invoice={issueInvoice.ok ? issueInvoice.invoice : null}
        onOpenChange={setGateOpen}
        open={gateOpen}
      />
      <Dialog onOpenChange={setPdfOpen} open={pdfOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("previewReal")}</DialogTitle>
          </DialogHeader>
          <InvoicePdfPreview
            className="mt-4"
            emptyLabel={t("previewLoading")}
            error={preview.error}
            lockedPreview
            updating={preview.updating}
            url={preview.url}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IssueHints({ message }: { message: string }) {
  const t = useTranslations("Generator");
  const keys = generatorIssueKeys(message);
  return (
    <div
      className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2.5"
      role="alert"
    >
      <p className="text-sm font-medium text-destructive">
        {t("errorInvoice")}
      </p>
      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm leading-snug text-muted-foreground">
        {keys.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
    </div>
  );
}

async function lookupPartyIco(
  side: "issuer" | "client",
  ico: string,
  last: React.MutableRefObject<string>,
  setDraft: React.Dispatch<React.SetStateAction<GeneratorDraft | null>>,
) {
  if (ico.length !== 8 || last.current === ico) return;
  last.current = ico;
  const result = await lookupAresByIco(ico, { endpoint: "generator" });
  if (!result.ok) return;
  setDraft((current) => {
    if (!current) return current;
    if (side === "issuer") {
      return withPrefillNumber({
        ...current,
        issuer: applyAresToIssuer(current.issuer, result.draft),
      });
    }
    return {
      ...current,
      client: applyAresToParty(current.client, result.draft),
    };
  });
}

function SettingsPanel({
  draft,
  vatLocked,
  onChange,
}: {
  draft: GeneratorDraft;
  vatLocked: boolean;
  onChange: (draft: GeneratorDraft) => void;
}) {
  const t = useTranslations("Generator");
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">{t("settings")}</h2>
      <Field label={t("currency")}>
        <select
          className={selectClassName()}
          onChange={(ev) =>
            onChange({
              ...draft,
              currency: ev.target.value === "EUR" ? "EUR" : "CZK",
            })
          }
          value={draft.currency}
        >
          <option value="CZK">CZK</option>
          <option value="EUR">EUR</option>
        </select>
      </Field>
      <Field label={t("language")}>
        <select
          className={selectClassName()}
          onChange={(ev) =>
            onChange({
              ...draft,
              language: ev.target.value === "en" ? "en" : "cs",
            })
          }
          value={draft.language}
        >
          <option value="cs">{t("languageCs")}</option>
          <option value="en">{t("languageEn")}</option>
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={draft.issuer.vatPayer}
          onCheckedChange={(checked) =>
            onChange({
              ...draft,
              issuer: { ...draft.issuer, vatPayer: checked === true },
              vatMode: checked === true ? draft.vatMode : "regular",
            })
          }
        />
        {t("vatPayer")}
      </label>
      {vatLocked ? null : (
        <Field label={t("vatMode")}>
          <select
            className={selectClassName()}
            onChange={(ev) =>
              onChange(
                withVatMode(
                  draft,
                  ev.target.value === "reverse_charge"
                    ? "reverse_charge"
                    : "regular",
                ),
              )
            }
            value={draft.vatMode}
          >
            <option value="regular">{t("vatRegular")}</option>
            <option value="reverse_charge">{t("vatReverse")}</option>
          </select>
        </Field>
      )}
      <AppearanceFields
        accentKey={draft.accentKey}
        showQr={draft.showQr}
        onAccent={(accentKey) => onChange({ ...draft, accentKey })}
        onShowQr={(showQr) => onChange({ ...draft, showQr })}
      />
    </section>
  );
}

function AppearanceFields({
  accentKey,
  showQr,
  onAccent,
  onShowQr,
}: {
  accentKey: GeneratorDraft["accentKey"];
  showQr: boolean;
  onAccent: (key: GeneratorDraft["accentKey"]) => void;
  onShowQr: (show: boolean) => void;
}) {
  const t = useTranslations("Generator");
  return (
    <section className="space-y-3">
      <p className="text-sm font-medium">{t("accent")}</p>
      <div className="flex flex-wrap gap-2">
        <button
          className={cn(
            "h-8 rounded-md border px-2.5 text-xs",
            accentKey === "default"
              ? "border-primary bg-primary/5"
              : "border-border",
          )}
          onClick={() => onAccent("default")}
          type="button"
        >
          {t("accentClassic")}
        </button>
        {ACCENT_KEYS.map((key) => (
          <button
            aria-label={key}
            className={cn(
              "size-8 rounded-md border",
              accentKey === key
                ? "border-primary ring-2 ring-primary/30"
                : "border-border",
            )}
            key={key}
            onClick={() => onAccent(key)}
            style={{ backgroundColor: ACCENT_COLOR_HEX[key] }}
            type="button"
          />
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={showQr}
          onCheckedChange={(checked) => onShowQr(checked === true)}
        />
        {t("showQr")}
      </label>
    </section>
  );
}
