"use client";

import {
  CURRENCY_OPTIONS,
  DUE_DATE_PRESETS,
  LANGUAGE_OPTIONS,
  VAT_OPTIONS,
} from "@/agent/lib/slack-invoice-actions";
import type {
  InvoiceCardModel,
  InvoiceCardState,
} from "@/agent/lib/invoice-card-model";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  AlertTriangleIcon,
  ExternalLinkIcon,
  FileTextIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

/** Values the card's inline `assumed` tag is appended with, mirroring Slack. */
const ASSUMED_SUFFIX = "  ·  _assumed_";

type ActionId =
  | "issue"
  | "mark_paid"
  | "send_email"
  | "discard"
  | "set_due"
  | "set_currency"
  | "set_vat"
  | "set_language";

/**
 * The review card, rendered for the web.
 *
 * Same model, same fields, same controls as the Slack card — `InvoiceCardModel`
 * is built once server-side and rendered twice. A click here posts to
 * `/api/assistant/card-action`, which runs the same shared action a Slack
 * button runs, so the model stays out of the loop on both surfaces and neither
 * costs a turn.
 */
export function AssistantInvoiceCard({ card }: { card: InvoiceCardModel }) {
  const t = useTranslations("Assistant.card");
  const [model, setModel] = useState(card);
  const [pending, setPending] = useState<ActionId | null>(null);
  const [discarded, setDiscarded] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const invoiceId = model.invoiceId;

  async function run(action: ActionId, value?: string) {
    if (!invoiceId || pending) return;
    setPending(action);
    try {
      const res = await fetch("/api/assistant/card-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, invoiceId, value: value ?? null }),
      });
      const data = (await res.json()) as
        | { ok: true; kind: "card"; card: InvoiceCardModel; note?: string }
        | { ok: true; kind: "discarded"; title: string }
        | { ok: false; message?: string };

      if (!data.ok) {
        toast.error(data.message ?? t("actionFailed"));
        return;
      }
      if (data.kind === "discarded") {
        setDiscarded(data.title);
        return;
      }
      setModel(data.card);
      setNote(data.note ?? null);
    } catch {
      toast.error(t("actionFailed"));
    } finally {
      setPending(null);
    }
  }

  if (discarded) {
    return (
      <CardShell>
        <p className="text-muted-foreground text-sm">
          {t("discarded", { title: discarded })}
        </p>
      </CardShell>
    );
  }

  const isDraft = model.state === "draft";

  return (
    <CardShell>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{model.title}</p>
          <p className="text-muted-foreground truncate text-xs">
            {model.subtitle}
          </p>
        </div>
        <StateBadge state={model.state} />
      </header>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        {model.fields.map((field) => {
          const assumed = field.value.endsWith(ASSUMED_SUFFIX);
          const value = assumed
            ? field.value.slice(0, -ASSUMED_SUFFIX.length)
            : field.value;
          return (
            <div className="min-w-0" key={field.label}>
              <dt className="text-muted-foreground text-[0.7rem] uppercase tracking-wide">
                {field.label}
              </dt>
              <dd className="truncate text-sm" title={value}>
                {value}
                {assumed ? (
                  <span className="text-muted-foreground ml-1 text-[0.7rem] italic">
                    {t("assumed")}
                  </span>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>

      {model.linesText ? <Lines text={model.linesText} /> : null}

      <Assumptions model={model} />

      {note ? (
        <p className="text-muted-foreground border-t pt-2 text-xs">{note}</p>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t pt-3">
        {isDraft && invoiceId ? (
          <>
            <Button
              disabled={pending !== null}
              onClick={() => void run("issue")}
              size="sm"
            >
              {pending === "issue" ? <Spinner /> : null}
              {t("issue")}
            </Button>
            <PdfButton invoiceId={invoiceId} label={t("previewPdf")} />
          </>
        ) : null}

        {invoiceId && (model.state === "issued" || model.state === "paid") ? (
          <>
            {model.state === "issued" ? (
              <Button
                disabled={pending !== null}
                onClick={() => void run("mark_paid")}
                size="sm"
              >
                {pending === "mark_paid" ? <Spinner /> : null}
                {t("markPaid")}
              </Button>
            ) : null}
            <Button
              disabled={pending !== null}
              onClick={() => void run("send_email")}
              size="sm"
              variant="outline"
            >
              {pending === "send_email" ? <Spinner /> : null}
              {t("sendEmail")}
            </Button>
            <PdfButton invoiceId={invoiceId} label={t("getPdf")} />
          </>
        ) : null}

        {model.webUrl ? (
          <Button
            render={
              <Link href={pathOf(model.webUrl)} prefetch={false}>
                <ExternalLinkIcon />
                {t("openInvoice")}
              </Link>
            }
            size="sm"
            variant="ghost"
          />
        ) : null}

        {isDraft && invoiceId ? (
          <Button
            className="text-destructive hover:text-destructive ml-auto"
            disabled={pending !== null}
            onClick={() => void run("discard")}
            size="sm"
            variant="ghost"
          >
            {pending === "discard" ? <Spinner /> : null}
            {t("discard")}
          </Button>
        ) : null}
      </div>

      {isDraft && invoiceId ? (
        <div className="grid grid-cols-2 gap-2">
          <Adjust
            disabled={pending !== null}
            label={t("dueDate")}
            onSelect={(value) => void run("set_due", value)}
            options={DUE_DATE_PRESETS.map((preset) => ({
              value: preset.value,
              label: preset.label,
            }))}
          />
          <Adjust
            disabled={pending !== null}
            label={t("currency")}
            onSelect={(value) => void run("set_currency", value)}
            options={CURRENCY_OPTIONS.map((code) => ({
              value: code,
              label: code,
            }))}
            value={currentFieldValue(model, "Currency")}
          />
          <Adjust
            disabled={pending !== null}
            label={t("vatTreatment")}
            onSelect={(value) => void run("set_vat", value)}
            options={VAT_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            value={
              VAT_OPTIONS.find(
                (option) =>
                  option.label === currentFieldValue(model, "VAT treatment"),
              )?.value
            }
          />
          <Adjust
            disabled={pending !== null}
            label={t("language")}
            onSelect={(value) => void run("set_language", value)}
            options={LANGUAGE_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            value={
              currentFieldValue(model, "Language") === "English" ? "en" : "cs"
            }
          />
        </div>
      ) : null}
    </CardShell>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card shadow-xs flex flex-col gap-3 rounded-xl border p-3">
      {children}
    </div>
  );
}

function StateBadge({ state }: { state: InvoiceCardState }) {
  const t = useTranslations("Assistant.card");
  const variant =
    state === "cancelled"
      ? "destructive"
      : state === "paid" || state === "issued"
        ? "default"
        : "secondary";
  return (
    <Badge className="shrink-0 capitalize" variant={variant}>
      {t(`state.${state}`)}
    </Badge>
  );
}

/** The tool renders lines as Slack-flavoured markdown; strip it back to text. */
function Lines({ text }: { text: string }) {
  const [heading, ...rows] = text.split("\n");
  return (
    <div className="bg-muted/40 rounded-lg p-2">
      <p className="text-muted-foreground mb-1 text-[0.7rem] uppercase tracking-wide">
        {stripMarks(heading ?? "")}
      </p>
      <ul className="space-y-0.5 text-xs">
        {rows.map((row, index) => (
          <li key={index}>{stripMarks(row)}</li>
        ))}
      </ul>
    </div>
  );
}

function Assumptions({ model }: { model: InvoiceCardModel }) {
  const t = useTranslations("Assistant.card");
  /**
   * Same filter as the Slack card: routine defaults stay tagged on their field
   * but out of the notice. A notice that flags seven things flags nothing.
   */
  const notable = model.assumptions.filter(
    (assumption) => assumption.severity !== "routine",
  );
  if (notable.length === 0) return null;

  const suspects = notable.filter((a) => a.kind === "suspect");
  const defaults = notable.filter((a) => a.kind !== "suspect");

  return (
    <div className="flex flex-col gap-2 border-t pt-2">
      {suspects.length > 0 ? (
        <div className="text-destructive flex gap-2 text-xs">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
          <div>
            <p className="font-medium">{t("checkBeforeIssuing")}</p>
            <ul className="mt-1 space-y-0.5">
              {suspects.map((assumption) => (
                <li key={assumption.path}>
                  <span className="font-medium">{assumption.label}</span> →{" "}
                  {assumption.value}{" "}
                  <span className="opacity-70">({assumption.reason})</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {defaults.length > 0 ? (
        <div className="text-muted-foreground flex gap-2 text-xs">
          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
          <div>
            <p className="font-medium">{t("assumedNotice")}</p>
            <ul className="mt-1 space-y-0.5">
              {defaults.map((assumption) => (
                <li key={assumption.path}>
                  <span className="font-medium">{assumption.label}</span> →{" "}
                  {assumption.value}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Adjust({
  label,
  options,
  value,
  disabled,
  onSelect,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value?: string;
  disabled?: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <Select
      disabled={disabled}
      onValueChange={(next) => {
        if (typeof next === "string" && next.length > 0) onSelect(next);
      }}
      value={value ?? null}
    >
      <SelectTrigger aria-label={label} className="w-full" size="sm">
        {/* Without a formatter the trigger shows the raw option value, so the
            VAT control would read `regular|none` instead of its label. */}
        <SelectValue placeholder={label}>
          {(current: unknown) =>
            options.find((option) => option.value === current)?.label ?? label
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PdfButton({ invoiceId, label }: { invoiceId: string; label: string }) {
  return (
    <Button
      render={
        <a
          href={`/api/invoices/${invoiceId}/pdf?disposition=inline`}
          rel="noreferrer"
          target="_blank"
        >
          <FileTextIcon />
          {label}
        </a>
      }
      size="sm"
      variant="outline"
    />
  );
}

/** Strips the `*bold*` / `_italic_` marks the shared model uses for Slack. */
function stripMarks(text: string): string {
  return text.replace(/[*_]/gu, "").trim();
}

function currentFieldValue(
  model: InvoiceCardModel,
  label: string,
): string | undefined {
  const raw = model.fields.find((field) => field.label === label)?.value;
  if (!raw) return undefined;
  return raw.split("  ·  ")[0]?.trim();
}

/** The model carries an absolute URL for Slack; in-app it should not reload. */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
