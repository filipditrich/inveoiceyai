"use client";

import * as React from "react";
import { DownloadGate } from "@/components/generator/download-gate";
import { useDemoInvoicePreview } from "@/components/generator/use-demo-preview";
import { Field, selectClassName } from "@/components/invoices/field";
import { InvoicePdfPreview } from "@/components/invoices/invoice-pdf-preview";
import { lookupAresByIco } from "@/components/issuers/issuer-form-shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { applyLookEdit } from "@/lib/generator/apply-look-edit";
import {
  applyAresToParty,
  emptyGeneratorDraft,
  guestDisplayInvoiceFromDraft,
  guestInvoiceFromDraft,
  guestPreviewInvoiceFromDraft,
  withPrefillNumber,
  type GeneratorDraft,
} from "@/lib/generator/draft";
import { readGeneratorHandoff } from "@/lib/generator/handoff";
import { appLocaleFrom } from "@/lib/generator/href";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { Inter } from "next/font/google";

import {
  LookDocumentView,
  renderSpaydQrDataUrl,
  type LookEdit,
} from "@invoicey/invoice-core/look-dom";
import { ACCENT_COLOR_HEX } from "@invoicey/invoice-core/looks";

const lookSans = Inter({ subsets: ["latin", "latin-ext"] });

const ACCENT_KEYS = [
  "neutral",
  "blue",
  "green",
  "amber",
  "rose",
  "violet",
] as const;

function patchDraft(
  setDraft: React.Dispatch<React.SetStateAction<GeneratorDraft | null>>,
  updater: (draft: GeneratorDraft) => GeneratorDraft,
) {
  setDraft((current) =>
    current ? withPrefillNumber(updater(current)) : current,
  );
}

export function GeneratorForm() {
  const t = useTranslations("Generator");
  const locale = appLocaleFrom(useLocale());
  const [draft, setDraft] = React.useState<GeneratorDraft | null>(null);
  const [gateOpen, setGateOpen] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const lastIssuerIco = React.useRef("");
  const lastClientIco = React.useRef("");

  React.useEffect(() => {
    const initial = emptyGeneratorDraft({
      issuerId: crypto.randomUUID(),
      clientId: crypto.randomUUID(),
      locale,
    });
    const handoff = readGeneratorHandoff();
    const issuerIco = handoff.issuerIco;
    if (!issuerIco) {
      setDraft(initial);
      return;
    }
    const withIco: GeneratorDraft = {
      ...initial,
      issuer: { ...initial.issuer, ico: issuerIco },
    };
    setDraft(withIco);
    void lookupAresByIco(issuerIco, { endpoint: "generator" }).then(
      (result) => {
        if (!result.ok) return;
        lastIssuerIco.current = issuerIco;
        setDraft((current) => {
          if (!current) return current;
          return withPrefillNumber({
            ...current,
            issuer: {
              ...current.issuer,
              ...applyAresToParty(current.issuer, result.draft),
            },
          });
        });
      },
    );
  }, [locale]);

  const previewBuild = React.useMemo(() => {
    if (!draft) return { invoice: null, display: null, error: null };
    const built = guestPreviewInvoiceFromDraft(draft);
    const display = guestDisplayInvoiceFromDraft(draft);
    if (built.ok) return { invoice: built.invoice, display, error: null };
    return { invoice: null, display: null, error: null };
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
  }, [issuerIco]);

  React.useEffect(() => {
    void lookupPartyIco("client", clientIco, lastClientIco, setDraft);
  }, [clientIco]);

  const preview = useDemoInvoicePreview(
    previewBuild.invoice,
    previewBuild.error,
  );

  function onDownload() {
    if (!draft) return;
    const built = guestInvoiceFromDraft(draft);
    if (!built.ok) {
      setFormError(t("errorInvoice"));
      return;
    }
    setFormError(null);
    setGateOpen(true);
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
      <div className="min-w-0 space-y-4">
        <p className="text-sm text-muted-foreground">{t("typeOnPage")}</p>
        <div className="overflow-x-auto rounded-lg border bg-muted/30 p-3 sm:p-6">
          {previewBuild.display ? (
            <div
              className={lookSans.className}
              style={{
                boxShadow: "0 8px 28px rgba(0, 0, 0, 0.18)",
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
      <aside className="space-y-6 xl:sticky xl:top-20 xl:self-start">
        <SettingsPanel
          draft={draft}
          vatLocked={vatLocked}
          onChange={(next) => patchDraft(setDraft, () => next)}
        />
        {formError ? (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        ) : null}
        <Button onClick={onDownload} size="lg" type="button">
          {t("download")}
        </Button>
        <div>
          <p className="mb-3 text-sm font-medium">{t("preview")}</p>
          <InvoicePdfPreview
            error={preview.error}
            lockedPreview
            updating={preview.updating}
            url={preview.url}
          />
        </div>
      </aside>
      <DownloadGate
        invoice={issueInvoice.ok ? issueInvoice.invoice : null}
        onOpenChange={setGateOpen}
        open={gateOpen}
      />
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
        issuer: {
          ...current.issuer,
          ...applyAresToParty(current.issuer, result.draft),
        },
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
      <Field label={t("vatMode")}>
        <select
          className={selectClassName()}
          disabled={vatLocked}
          onChange={(ev) =>
            onChange({
              ...draft,
              vatMode:
                ev.target.value === "reverse_charge"
                  ? "reverse_charge"
                  : "regular",
            })
          }
          value={vatLocked ? "regular" : draft.vatMode}
        >
          <option value="regular">{t("vatRegular")}</option>
          <option value="reverse_charge">{t("vatReverse")}</option>
        </select>
      </Field>
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
          Classic
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
