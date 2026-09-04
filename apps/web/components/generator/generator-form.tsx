"use client";

import * as React from "react";
import { DownloadGate } from "@/components/generator/download-gate";
import { PartyFields } from "@/components/generator/party-fields";
import { useDemoInvoicePreview } from "@/components/generator/use-demo-preview";
import { Field, selectClassName } from "@/components/invoices/field";
import { InvoicePdfPreview } from "@/components/invoices/invoice-pdf-preview";
import { lookupAresByIco } from "@/components/issuers/issuer-form-shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  applyAresToParty,
  emptyGeneratorDraft,
  guestInvoiceFromDraft,
  guestPreviewInvoiceFromDraft,
  withPrefillNumber,
  type GeneratorDraft,
  type GeneratorLine,
} from "@/lib/generator/draft";
import { readGeneratorHandoff } from "@/lib/generator/handoff";
import { appLocaleFrom } from "@/lib/generator/href";
import { cn } from "@/lib/utils";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { ACCENT_COLOR_HEX } from "@invoicey/invoice-core/looks";

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

  React.useEffect(() => {
    const initial = emptyGeneratorDraft({
      issuerId: crypto.randomUUID(),
      clientId: crypto.randomUUID(),
      locale,
    });
    const handoff = readGeneratorHandoff();
    if (!handoff.issuerIco) {
      setDraft(initial);
      return;
    }
    const withIco: GeneratorDraft = {
      ...initial,
      issuer: { ...initial.issuer, ico: handoff.issuerIco },
    };
    setDraft(withIco);
    void lookupAresByIco(handoff.issuerIco, { endpoint: "generator" }).then(
      (result) => {
        if (!result.ok) return;
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
    if (!draft) return { invoice: null, error: null };
    const built = guestPreviewInvoiceFromDraft(draft);
    if (built.ok) return { invoice: built.invoice, error: null };
    return { invoice: null, error: null };
  }, [draft]);

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

  if (!draft) {
    return <p className="text-sm text-muted-foreground">{t("preview")}</p>;
  }

  const issueInvoice = guestInvoiceFromDraft(draft);
  const vatLocked = !draft.issuer.vatPayer;

  return (
    <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
      <div className="space-y-10">
        <PartyFields
          issuer={draft.issuer}
          kind="issuer"
          onIssuer={(issuer) =>
            patchDraft(setDraft, (current) => ({ ...current, issuer }))
          }
          party={draft.issuer}
        />
        <PartyFields
          kind="client"
          onParty={(client) =>
            patchDraft(setDraft, (current) => ({ ...current, client }))
          }
          party={draft.client}
        />
        <MetaFields
          draft={draft}
          vatLocked={vatLocked}
          onChange={(next) => patchDraft(setDraft, () => next)}
        />
        <LineItems
          items={draft.items}
          vatLocked={vatLocked}
          onChange={(items) =>
            patchDraft(setDraft, (current) => ({ ...current, items }))
          }
        />
        <Field label={t("notes")}>
          <Textarea
            onChange={(ev) =>
              patchDraft(setDraft, (current) => ({
                ...current,
                notes: ev.target.value,
              }))
            }
            rows={3}
            value={draft.notes}
          />
        </Field>
        <AppearanceFields
          accentKey={draft.accentKey}
          showQr={draft.showQr}
          onAccent={(accentKey) =>
            patchDraft(setDraft, (current) => ({ ...current, accentKey }))
          }
          onShowQr={(showQr) =>
            patchDraft(setDraft, (current) => ({ ...current, showQr }))
          }
        />
        {formError ? (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        ) : null}
        <Button onClick={onDownload} size="lg" type="button">
          {t("download")}
        </Button>
      </div>
      <aside className="xl:sticky xl:top-20 xl:self-start">
        <p className="mb-3 text-sm font-medium">{t("preview")}</p>
        <InvoicePdfPreview
          error={preview.error}
          lockedPreview
          updating={preview.updating}
          url={preview.url}
        />
      </aside>
      <DownloadGate
        invoice={issueInvoice.ok ? issueInvoice.invoice : null}
        onOpenChange={setGateOpen}
        open={gateOpen}
      />
    </div>
  );
}

function MetaFields({
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
    <section className="grid gap-4 sm:grid-cols-2">
      <Field label={t("number")}>
        <Input
          onChange={(ev) =>
            onChange({ ...draft, number: ev.target.value, numberTouched: true })
          }
          value={draft.number}
        />
      </Field>
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
      <Field label={t("issueDate")}>
        <Input
          onChange={(ev) => onChange({ ...draft, issueDate: ev.target.value })}
          type="date"
          value={draft.issueDate}
        />
      </Field>
      <Field label={t("dueDate")}>
        <Input
          onChange={(ev) => onChange({ ...draft, dueDate: ev.target.value })}
          type="date"
          value={draft.dueDate}
        />
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
    </section>
  );
}

function LineItems({
  items,
  vatLocked,
  onChange,
}: {
  items: GeneratorLine[];
  vatLocked: boolean;
  onChange: (items: GeneratorLine[]) => void;
}) {
  const t = useTranslations("Generator");

  function patch(index: number, patch: Partial<GeneratorLine>) {
    onChange(
      items.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">{t("items")}</h2>
      {items.map((line, index) => (
        <div
          className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_5.5rem_5rem_7rem_5.5rem_auto]"
          key={`line-${String(index)}`}
        >
          <Field label={t("description")}>
            <Input
              onChange={(ev) => patch(index, { description: ev.target.value })}
              value={line.description}
            />
          </Field>
          <Field label={t("quantity")}>
            <Input
              onChange={(ev) =>
                patch(index, { quantity: Number(ev.target.value) || 0 })
              }
              type="number"
              value={line.quantity}
            />
          </Field>
          <Field label={t("unit")}>
            <Input
              onChange={(ev) => patch(index, { unit: ev.target.value })}
              value={line.unit}
            />
          </Field>
          <Field label={t("price")}>
            <Input
              onChange={(ev) =>
                patch(index, {
                  unitPriceWithoutVat: Number(ev.target.value) || 0,
                })
              }
              type="number"
              value={line.unitPriceWithoutVat}
            />
          </Field>
          <Field label={t("vatRate")}>
            <Input
              disabled={vatLocked}
              onChange={(ev) =>
                patch(index, { vatRate: Number(ev.target.value) || 0 })
              }
              type="number"
              value={vatLocked ? 0 : line.vatRate}
            />
          </Field>
          <div className="flex items-end">
            <Button
              aria-label={t("removeLine")}
              disabled={items.length === 1}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              type="button"
              variant="ghost"
            >
              <Trash2Icon />
            </Button>
          </div>
        </div>
      ))}
      <Button
        onClick={() =>
          onChange([
            ...items,
            {
              description: "",
              quantity: 1,
              unit: "ks",
              unitPriceWithoutVat: 0,
              vatRate: vatLocked ? 0 : 21,
            },
          ])
        }
        type="button"
        variant="outline"
      >
        <PlusIcon data-icon="inline-start" />
        {t("addLine")}
      </Button>
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
