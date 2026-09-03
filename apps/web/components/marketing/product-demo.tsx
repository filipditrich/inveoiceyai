"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Tabs } from "@base-ui/react/tabs";
import {
  ArrowRightIcon,
  BotIcon,
  CalendarSyncIcon,
  CheckIcon,
  FileCheck2Icon,
  LandmarkIcon,
  SparklesIcon,
  SquareTerminalIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import styles from "./product-demo.module.css";

/** How long one flow stays on screen before the demo advances itself. */
const AUTOPLAY_MS = 7_000;

const FLOWS = [
  { icon: SparklesIcon, id: "draft" },
  { icon: BotIcon, id: "agent" },
  { icon: LandmarkIcon, id: "payments" },
  { icon: CalendarSyncIcon, id: "recurring" },
  { icon: SquareTerminalIcon, id: "cli" },
] as const;

type FlowId = (typeof FLOWS)[number]["id"];

export function ProductDemo() {
  const t = useTranslations("Marketing.demo");
  const [active, setActive] = useState<FlowId>("draft");
  const [autoplay, setAutoplay] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAutoplay(false);
    }
  }, []);

  useEffect(() => {
    if (!autoplay || paused) return;
    const timer = window.setTimeout(() => {
      setActive((current) => {
        const index = FLOWS.findIndex((flow) => flow.id === current);
        return FLOWS[(index + 1) % FLOWS.length]!.id;
      });
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, autoplay, paused]);

  /** A deliberate pick wins: stop rotating and leave the visitor in control. */
  const selectFlow = useCallback((value: Tabs.Tab.Value) => {
    const picked = FLOWS.find((flow) => flow.id === value);
    if (!picked) return;
    setActive(picked.id);
    setAutoplay(false);
  }, []);

  return (
    <Tabs.Root
      value={active}
      onValueChange={selectFlow}
      className="flex flex-col items-center gap-6"
      aria-label={t("ariaLabel")}
    >
      {/* Wraps rather than scrolls: a hidden tab is a tab nobody clicks. */}
      <Tabs.List className="flex max-w-full flex-wrap justify-center gap-1">
        {FLOWS.map((flow) => {
          const isActive = flow.id === active;
          return (
            <Tabs.Tab
              key={flow.id}
              value={flow.id}
              className={cn(
                "relative isolate shrink-0 overflow-hidden rounded-full border px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                isActive
                  ? "border-border bg-card text-foreground shadow-xs"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <flow.icon className="-mt-0.5 mr-1.5 inline size-3.5" />
              {t(`${flow.id}Tab`)}
              {isActive && autoplay && !paused ? (
                <span
                  key={active}
                  className={styles.tabProgress}
                  style={{ animationDuration: `${AUTOPLAY_MS}ms` }}
                  aria-hidden="true"
                />
              ) : null}
            </Tabs.Tab>
          );
        })}
      </Tabs.List>

      <div
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        className="relative w-full"
      >
        <div className="absolute -inset-x-6 -top-6 bottom-8 -z-10 rounded-[3rem] bg-radial from-brand/20 to-transparent blur-2xl" />
        {FLOWS.map((flow) => (
          <Tabs.Panel
            key={flow.id}
            value={flow.id}
            keepMounted={false}
            className="outline-none"
          >
            <AppWindow caption={t(`${flow.id}Caption`)}>
              <DemoScreen id={flow.id} />
            </AppWindow>
          </Tabs.Panel>
        ))}
      </div>
    </Tabs.Root>
  );
}

/** Window chrome so the panels read as "this is the product", not "this is art". */
function AppWindow({
  caption,
  children,
}: Readonly<{ caption: string; children: ReactNode }>) {
  return (
    <figure className={styles.window}>
      <div className="flex items-center gap-2 border-b border-white/8 bg-white/3 px-4 py-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="mx-auto rounded-md bg-white/5 px-3 py-1 font-mono text-[0.65rem] text-zinc-400">
          invoicey.app
        </span>
      </div>
      <div className={styles.screen}>{children}</div>
      <figcaption className="border-t border-white/8 bg-white/3 px-4 py-3 text-center text-xs text-zinc-400">
        {caption}
      </figcaption>
    </figure>
  );
}

function DemoScreen({ id }: Readonly<{ id: FlowId }>) {
  switch (id) {
    case "agent":
      return <AgentScreen />;
    case "payments":
      return <PaymentsScreen />;
    case "recurring":
      return <RecurringScreen />;
    case "cli":
      return <CliScreen />;
    default:
      return <DraftScreen />;
  }
}

/* ---------------------------------------------------------------- primitives */

const NAV_ITEMS = [
  "dashboard",
  "invoices",
  "recurring",
  "clients",
  "payments",
  "issuers",
] as const;

function Chrome({
  activeNav,
  children,
  title,
}: Readonly<{
  activeNav: (typeof NAV_ITEMS)[number];
  children: ReactNode;
  title: string;
}>) {
  const t = useTranslations("Marketing.demo.nav");
  return (
    <div className="flex h-full">
      <aside className="hidden w-40 shrink-0 flex-col gap-1 border-r border-white/8 p-3 md:flex">
        <div className="mb-3 flex items-center gap-2 px-1">
          <span className="grid size-6 place-items-center rounded-lg bg-brand text-[0.6rem] font-bold text-brand-foreground">
            I
          </span>
          <span className="text-xs font-semibold text-zinc-200">Invoicey</span>
        </div>
        {NAV_ITEMS.map((item) => (
          <span
            key={item}
            className={cn(
              "rounded-lg px-2 py-1.5 text-[0.7rem]",
              item === activeNav
                ? "bg-white/10 font-medium text-white"
                : "text-zinc-500",
            )}
          >
            {t(item)}
          </span>
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
          <span className="text-xs font-medium text-zinc-200">{title}</span>
          <span
            className="size-5 rounded-full bg-white/10"
            aria-hidden="true"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({
  delay,
  label,
  value,
}: Readonly<{ delay: number; label: string; value: string }>) {
  return (
    <div className={styles.reveal} style={{ animationDelay: `${delay}ms` }}>
      <p className="text-[0.55rem] tracking-[0.16em] text-zinc-500 uppercase">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-medium text-zinc-100">{value}</p>
    </div>
  );
}

function Pill({
  children,
  tone = "neutral",
}: Readonly<{ children: ReactNode; tone?: "brand" | "good" | "neutral" }>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6rem] font-medium",
        tone === "good" && "bg-emerald-500/12 text-emerald-300",
        tone === "brand" && "bg-brand/20 text-brand",
        tone === "neutral" && "bg-white/8 text-zinc-300",
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------- flows */

function DraftScreen() {
  const t = useTranslations("Marketing.demo.draft");
  const fields = [
    { label: t("clientLabel"), value: "Studio Sever s.r.o." },
    { label: t("icoLabel"), value: "087 54 321 ✓" },
    { label: t("itemLabel"), value: t("itemValue") },
    { label: t("amountLabel"), value: t("amountValue") },
    { label: t("vatLabel"), value: t("vatValue") },
    { label: t("dueLabel"), value: t("dueValue") },
  ];

  return (
    <Chrome activeNav="invoices" title={t("chromeTitle")}>
      <div className="grid h-full gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/4 p-3">
            <p className="flex items-center gap-1.5 text-[0.6rem] font-semibold tracking-[0.16em] text-brand uppercase">
              <SparklesIcon className="size-3" /> {t("promptLabel")}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-300">
              {t("prompt")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 p-3">
            {fields.map((field, index) => (
              <Field
                key={field.label}
                delay={120 + index * 140}
                label={field.label}
                value={field.value}
              />
            ))}
          </div>
          <div className={styles.reveal} style={{ animationDelay: "980ms" }}>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="good">
                <CheckIcon className="size-2.5" /> {t("valid")}
              </Pill>
              <Pill>PDF</Pill>
              <Pill>ISDOC</Pill>
              <Pill>QR · SPAYD</Pill>
            </div>
          </div>
        </div>
        <div className="hidden rounded-xl border border-white/10 bg-white/4 p-4 lg:flex lg:flex-col">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[0.55rem] tracking-[0.16em] text-zinc-500 uppercase">
                {t("previewLabel")}
              </p>
              <p className="mt-1 font-mono text-xs text-zinc-300">2026-0048</p>
            </div>
            <Pill tone="good">{t("status")}</Pill>
          </div>
          <div className="mt-4 space-y-2">
            {[92, 74, 58, 84, 46].map((width, index) => (
              <span
                key={width}
                className={cn(styles.reveal, "block h-2 rounded bg-white/8")}
                style={{
                  animationDelay: `${400 + index * 90}ms`,
                  width: `${width}%`,
                }}
              />
            ))}
          </div>
          <div className="mt-auto flex items-end justify-between border-t border-white/8 pt-4">
            <span className="grid size-10 place-items-center rounded-lg border border-white/10 text-[0.5rem] text-zinc-400">
              QR
            </span>
            <div className="text-right">
              <p className="text-[0.55rem] tracking-[0.16em] text-zinc-500 uppercase">
                {t("totalLabel")}
              </p>
              <p className="text-lg font-semibold text-white">
                {t("amountValue")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Chrome>
  );
}

function AgentScreen() {
  const t = useTranslations("Marketing.demo.agent");
  return (
    <Chrome activeNav="invoices" title={t("chromeTitle")}>
      <div className="mx-auto flex h-full max-w-lg flex-col justify-center gap-3">
        <div
          className={cn(styles.reveal, "ml-auto max-w-[85%]")}
          style={{ animationDelay: "80ms" }}
        >
          <p className="rounded-2xl rounded-br-md bg-white/8 px-3.5 py-2.5 text-xs leading-relaxed text-zinc-200">
            {t("userMessage")}
          </p>
        </div>
        <div
          className={cn(styles.reveal, "max-w-[92%] space-y-2")}
          style={{ animationDelay: "560ms" }}
        >
          <div className="rounded-2xl rounded-bl-md border border-white/10 bg-white/4 p-3">
            <p className="flex items-center gap-1.5 text-[0.65rem] font-medium text-zinc-200">
              <BotIcon className="size-3 text-brand" /> Invoicey
            </p>
            <div className="mt-2.5 space-y-1.5 rounded-lg bg-black/25 p-2.5 font-mono text-[0.6rem] text-zinc-400">
              {[t("toolAres"), t("toolIssuer"), t("toolCreate")].map((step) => (
                <p key={step}>
                  <span className="text-emerald-400">✓</span> {step}
                </p>
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <Pill>{t("amount")}</Pill>
              <Pill>{t("due")}</Pill>
            </div>
            <div className="mt-3 flex gap-2">
              <span className="rounded-lg bg-brand px-2.5 py-1.5 text-[0.6rem] font-semibold text-brand-foreground">
                {t("actionIssue")}
              </span>
              <span className="rounded-lg border border-white/12 px-2.5 py-1.5 text-[0.6rem] font-medium text-zinc-300">
                {t("actionEdit")}
              </span>
            </div>
          </div>
          <p className="px-1 text-[0.6rem] text-zinc-500">{t("note")}</p>
        </div>
      </div>
    </Chrome>
  );
}

function PaymentsScreen() {
  const t = useTranslations("Marketing.demo.payments");
  const rows = [
    { amount: t("row1Amount"), vs: "2026 0049", when: t("today0914") },
    { amount: t("row2Amount"), vs: "2026 0048", when: t("today0802") },
    { amount: t("row3Amount"), vs: "—", when: t("yesterday") },
  ];

  return (
    <Chrome activeNav="payments" title={t("chromeTitle")}>
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center gap-2">
          <Pill tone="good">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            {t("synced")}
          </Pill>
          <Pill>{t("unmatched")}</Pill>
        </div>
        <div className="divide-y divide-white/8 overflow-hidden rounded-xl border border-white/10">
          {rows.map((row, index) => (
            <div
              key={row.vs}
              className={cn(
                styles.reveal,
                "grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2.5",
                index === 0 && "bg-brand/8",
              )}
              style={{ animationDelay: `${index * 140}ms` }}
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-zinc-100">
                  {row.amount}
                </p>
                <p className="mt-0.5 font-mono text-[0.6rem] text-zinc-500">
                  VS {row.vs} · {row.when}
                </p>
              </div>
              {index === 0 ? (
                <Pill tone="brand">{t("matchProposed")}</Pill>
              ) : index === 1 ? (
                <Pill tone="good">
                  <CheckIcon className="size-2.5" /> {t("paid")}
                </Pill>
              ) : (
                <Pill>{t("review")}</Pill>
              )}
            </div>
          ))}
        </div>
        <div
          className={cn(
            styles.reveal,
            "rounded-xl border border-brand/30 bg-brand/8 p-3",
          )}
          style={{ animationDelay: "520ms" }}
        >
          <p className="flex items-center gap-1.5 text-xs font-medium text-zinc-100">
            <SparklesIcon className="size-3 shrink-0 text-brand" />
            {t("matchTitle")}
          </p>
          <p className="mt-1 text-[0.65rem] text-zinc-400">{t("matchNote")}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <span className="rounded-lg bg-brand px-2.5 py-1.5 text-[0.6rem] font-semibold text-brand-foreground">
              {t("confirm")}
            </span>
            <span className="rounded-lg border border-white/12 px-2.5 py-1.5 text-[0.6rem] font-medium text-zinc-300">
              {t("pickAnother")}
            </span>
          </div>
        </div>
      </div>
    </Chrome>
  );
}

function RecurringScreen() {
  const t = useTranslations("Marketing.demo.recurring");
  const rows = [
    { cadence: t("cadenceMonthlyFirst"), name: "Studio Sever", next: "1. 10." },
    { cadence: t("cadenceQuarterly"), name: "Ateliér 21", next: "1. 10." },
    { cadence: t("cadenceMonthlyLast"), name: "Kavárna Místo", next: "30. 9." },
  ];

  return (
    <Chrome activeNav="recurring" title={t("chromeTitle")}>
      <div className="flex h-full flex-col gap-3">
        <div className="overflow-hidden rounded-xl border border-white/10">
          <div className="grid grid-cols-[1.4fr_1fr_auto] gap-3 border-b border-white/8 bg-white/3 px-3 py-2 text-[0.55rem] tracking-[0.14em] text-zinc-500 uppercase">
            <span>{t("colClient")}</span>
            <span>{t("colCadence")}</span>
            <span>{t("colNext")}</span>
          </div>
          {rows.map((row, index) => (
            <div
              key={row.name}
              className={cn(
                styles.reveal,
                "grid grid-cols-[1.4fr_1fr_auto] items-center gap-3 border-b border-white/6 px-3 py-2.5 text-xs text-zinc-200 last:border-0",
              )}
              style={{ animationDelay: `${index * 130}ms` }}
            >
              <span className="truncate font-medium">{row.name}</span>
              <span className="truncate text-zinc-400">{row.cadence}</span>
              <span className="text-zinc-400">{row.next}</span>
            </div>
          ))}
        </div>
        <div
          className={cn(
            styles.reveal,
            "flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/4 p-3",
          )}
          style={{ animationDelay: "480ms" }}
        >
          <CalendarSyncIcon className="size-3.5 shrink-0 text-brand" />
          <p className="flex-1 text-xs text-zinc-300">{t("draftNote")}</p>
          <Pill tone="brand">{t("badge")}</Pill>
        </div>
        <div
          className={cn(
            styles.reveal,
            "flex items-center gap-2 rounded-xl border border-white/10 p-3",
          )}
          style={{ animationDelay: "620ms" }}
        >
          <FileCheck2Icon className="size-3.5 shrink-0 text-zinc-400" />
          <p className="text-xs text-zinc-400">{t("reminderNote")}</p>
        </div>
      </div>
    </Chrome>
  );
}

function CliScreen() {
  const t = useTranslations("Marketing.demo.cli");
  const lines = [
    { text: "$ invoicey invoices list --status overdue", tone: "cmd" },
    { text: "2026-0041  Ateliér 21     58 080 CZK  12d", tone: "out" },
    { text: "2026-0037  Kavárna Místo  18 500 CZK   3d", tone: "out" },
    { text: "$ invoicey invoices remind 2026-0041", tone: "cmd" },
    { text: `✓ ${t("reminderSent")}`, tone: "ok" },
  ];
  const files = [
    "2026-0048 · Studio Sever.pdf",
    "2026-0048 · Studio Sever.isdoc",
    "2026-0049 · Ateliér 21.pdf",
    "2026-0049 · Ateliér 21.isdoc",
  ];

  return (
    <div className="grid h-full lg:grid-cols-2">
      <div className="flex flex-col border-b border-white/8 p-4 lg:border-r lg:border-b-0">
        <p className="flex items-center gap-1.5 text-[0.6rem] font-semibold tracking-[0.16em] text-brand uppercase">
          <SquareTerminalIcon className="size-3" /> {t("terminalLabel")}
        </p>
        <div className="mt-3 space-y-1.5 font-mono text-[0.65rem] leading-relaxed">
          {lines.map((line, index) => (
            <p
              key={line.text}
              className={cn(
                styles.reveal,
                "truncate",
                line.tone === "cmd" && "text-zinc-100",
                line.tone === "out" && "text-zinc-500",
                line.tone === "ok" && "text-emerald-400",
              )}
              style={{ animationDelay: `${index * 220}ms` }}
            >
              {line.text}
            </p>
          ))}
        </div>
      </div>
      <div className="flex flex-col p-4">
        <p className="text-[0.6rem] font-semibold tracking-[0.16em] text-brand uppercase">
          {t("finderLabel")}
        </p>
        <div className="mt-3 space-y-1.5">
          {files.map((file, index) => (
            <p
              key={file}
              className={cn(
                styles.reveal,
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[0.68rem] text-zinc-300 odd:bg-white/4",
              )}
              style={{ animationDelay: `${index * 160}ms` }}
            >
              <FileCheck2Icon className="size-3 shrink-0 text-zinc-500" />
              <span className="truncate">{file}</span>
            </p>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[0.65rem] text-zinc-500">
          {t("mirrorNote")}
          <ArrowRightIcon className="size-3" />
        </p>
      </div>
    </div>
  );
}
