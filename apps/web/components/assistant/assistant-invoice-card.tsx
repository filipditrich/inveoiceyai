"use client";

import { copyFor } from "@/agent/lib/invoice-card-i18n";
import type {
  InvoiceCardModel,
  InvoiceCardState,
} from "@/agent/lib/invoice-card-model";
import {
  CURRENCY_OPTIONS,
  DUE_DATE_PRESETS,
  LANGUAGE_OPTIONS,
  VAT_OPTIONS,
  type ChangeField,
} from "@/agent/lib/slack-invoice-actions";
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

type ActionId = "issue" | "mark_paid" | "send_email" | "discard" | "change";

/**
 * The review card, rendered for the web.
 *
 * Same model, same option codes and — via `copyFor` — the same words as the
 * Slack card. `InvoiceCardModel` is built once server-side and rendered twice,
 * so a field tagged "doplněno" in a thread is tagged "doplněno" here, in the
 * invoice's own language rather than the UI's.
 *
 * A click posts to `/api/assistant/card-action`, which runs the same effect a
 * Slack option runs, carrying `assumedPaths` so editing one field does not
 * silently clear the warnings on the others.
 */
export function AssistantInvoiceCard({ card }: { card: InvoiceCardModel }) {
  const t = useTranslations("Assistant.card");
  const [model, setModel] = useState(card);
  const [pending, setPending] = useState<ActionId | null>(null);
  const [discarded, setDiscarded] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const invoiceId = model.invoiceId;
  const copy = copyFor(model.locale);
  const assumedSuffix = `  ·  _${copy.text.assumedTag}_`;

  async function run(
    action: ActionId,
    change?: { field: ChangeField; value: string },
  ) {
    if (!invoiceId || pending) return;
    setPending(action);
    try {
      const res = await fetch("/api/assistant/card-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          invoiceId,
          assumedPaths: model.assumedPaths,
          ...change,
        }),
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
          {copy.text.discarded} · {discarded}
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
        <StateBadge label={copy.state[model.state]} state={model.state} />
      </header>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        {model.fields.map((field) => {
          const assumed = field.value.endsWith(assumedSuffix);
          const value = assumed
            ? field.value.slice(0, -assumedSuffix.length)
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
                    {copy.text.assumedTag}
                  </span>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>

      {model.linesText ? <Lines text={model.linesText} /> : null}

      <Notices model={model} />

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
              {copy.action.issue}
            </Button>
            <PdfButton invoiceId={invoiceId} label={copy.action.previewPdf} />
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
                {copy.action.markPaid}
              </Button>
            ) : null}
            <Button
              disabled={pending !== null}
              onClick={() => void run("send_email")}
              size="sm"
              variant="outline"
            >
              {pending === "send_email" ? <Spinner /> : null}
              {copy.action.sendEmail}
            </Button>
            <PdfButton invoiceId={invoiceId} label={copy.action.getPdf} />
          </>
        ) : null}

        {model.webUrl ? (
          <Button
            render={
              <Link href={pathOf(model.webUrl)} prefetch={false}>
                <ExternalLinkIcon />
                {copy.action.openWeb}
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
            {copy.action.discard}
          </Button>
        ) : null}
      </div>

      {isDraft && invoiceId ? (
        <ChangeMenu
          copy={copy}
          disabled={pending !== null}
          onChange={(field, value) => void run("change", { field, value })}
        />
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

function StateBadge({
  state,
  label,
}: {
  state: InvoiceCardState;
  label: string;
}) {
  const variant =
    state === "cancelled"
      ? "destructive"
      : state === "paid" || state === "issued"
        ? "default"
        : "secondary";
  return (
    <Badge className="shrink-0" variant={variant}>
      {label}
    </Badge>
  );
}

/**
 * One menu for every draft adjustment, matching the Slack card.
 *
 * The option labels are built from the same copy and the same codes, so the
 * two surfaces offer literally the same list.
 */
function ChangeMenu({
  copy,
  disabled,
  onChange,
}: {
  copy: ReturnType<typeof copyFor>;
  disabled: boolean;
  onChange: (field: ChangeField, value: string) => void;
}) {
  const options: Array<{ id: string; label: string }> = [
    ...DUE_DATE_PRESETS.map((preset) => ({
      id: `d:${preset.value}`,
      label: `${copy.option.due} ${preset.days} ${copy.option.days}`,
    })),
    ...CURRENCY_OPTIONS.map((code) => ({
      id: `c:${code}`,
      label: `${copy.option.currency} ${code}`,
    })),
    ...VAT_OPTIONS.map((vat) => ({
      id: `v:${vat.value}`,
      label: `${copy.option.vat} ${copy.vatMode[vat.mode] ?? vat.mode} · ${
        copy.suppliesAbroad[vat.suppliesAbroad] ?? vat.suppliesAbroad
      }`,
    })),
    ...LANGUAGE_OPTIONS.map((code) => ({
      id: `l:${code}`,
      label: `${copy.option.language} ${copy.language[code]}`,
    })),
  ];

  return (
    <Select
      disabled={disabled}
      onValueChange={(next: unknown) => {
        /** Option ids are `<field>:<value>` — the same pair a Slack option carries. */
        if (typeof next !== "string") return;
        const separator = next.indexOf(":");
        if (separator <= 0) return;
        onChange(
          next.slice(0, separator) as ChangeField,
          next.slice(separator + 1),
        );
      }}
      /** Never holds a selection: picking an option applies it and resets. */
      value={null}
    >
      <SelectTrigger
        aria-label={copy.action.change}
        className="w-full"
        size="sm"
      >
        {/* Always the prompt: this is a menu of edits, not a current value. */}
        <SelectValue placeholder={copy.action.change}>
          {() => copy.action.change}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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

/**
 * The "we filled this in" / "check this" block.
 *
 * Same split as the Slack card: a value that looks invented leads, defaults
 * follow. Routine defaults never reach `notice` at all — a warning that flags
 * seven things flags nothing.
 */
function Notices({ model }: { model: InvoiceCardModel }) {
  const copy = copyFor(model.locale);
  if (model.notice.length === 0) return null;

  const suspects = model.notice.filter((entry) => entry.kind === "suspect");
  const defaults = model.notice.filter((entry) => entry.kind !== "suspect");

  return (
    <div className="flex flex-col gap-2 border-t pt-2">
      {suspects.length > 0 ? (
        <div className="text-destructive flex gap-2 text-xs">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
          <div>
            <p className="font-medium">
              {stripMarks(copy.text.suspectHeading)}
            </p>
            <ul className="mt-1 space-y-0.5">
              {suspects.map((entry) => (
                <li key={entry.label}>
                  <span className="font-medium">{entry.label}</span> →{" "}
                  {entry.value}{" "}
                  <span className="opacity-70">({entry.reason})</span>
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
            <p className="font-medium">
              {stripMarks(copy.text.assumedHeading)}
            </p>
            <ul className="mt-1 space-y-0.5">
              {defaults.map((entry) => (
                <li key={entry.label}>
                  <span className="font-medium">{entry.label}</span> →{" "}
                  {entry.value}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
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

/** Strips the `*bold*` / `_italic_` marks and `:emoji:` the model uses for Slack. */
function stripMarks(text: string): string {
  return text
    .replace(/:[a-z0-9_+-]+:/gu, "")
    .replace(/[*_]/gu, "")
    .trim();
}

/** The model carries an absolute URL for Slack; in-app it should not reload. */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
