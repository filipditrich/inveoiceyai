"use client";

import * as React from "react";
import { quickSearchAction, type QuickSearchResult } from "@/actions/search";
import { Kbd } from "@/components/ui/kbd";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Dialog } from "@base-ui/react/dialog";
import {
  ArchiveRestoreIcon,
  BracesIcon,
  Building2Icon,
  FileTextIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  LoaderCircleIcon,
  PlusIcon,
  RepeatIcon,
  Rows3Icon,
  SearchIcon,
  Settings2Icon,
  SparklesIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import type { AppLocale } from "@/i18n/config";

type CommandKey =
  | "dashboard"
  | "invoices"
  | "payments"
  | "clients"
  | "issuers"
  | "newInvoice"
  | "aiDraft"
  | "recurring"
  | "fromJson"
  | "import"
  | "workspaceSettings"
  | "looks"
  | "accountSettings";

interface StaticCommand {
  key: CommandKey;
  href: string;
  icon: React.ReactNode;
  group: "go" | "create" | "settings";
}

const STATIC_COMMANDS: StaticCommand[] = [
  {
    key: "dashboard",
    href: "/dashboard",
    icon: <LayoutDashboardIcon />,
    group: "go",
  },
  { key: "invoices", href: "/invoices", icon: <FileTextIcon />, group: "go" },
  { key: "payments", href: "/payments", icon: <LandmarkIcon />, group: "go" },
  { key: "clients", href: "/clients", icon: <UsersIcon />, group: "go" },
  { key: "issuers", href: "/issuers", icon: <Building2Icon />, group: "go" },
  {
    key: "newInvoice",
    href: "/invoices/new",
    icon: <PlusIcon />,
    group: "create",
  },
  {
    key: "aiDraft",
    href: "/invoices/ai",
    icon: <SparklesIcon />,
    group: "create",
  },
  {
    key: "recurring",
    href: "/invoices/recurring",
    icon: <RepeatIcon />,
    group: "create",
  },
  {
    key: "import",
    href: "/invoices/import",
    icon: <ArchiveRestoreIcon />,
    group: "create",
  },
  {
    key: "fromJson",
    href: "/invoices/from-json",
    icon: <BracesIcon />,
    group: "create",
  },
  {
    key: "workspaceSettings",
    href: "/settings/workspace",
    icon: <Settings2Icon />,
    group: "settings",
  },
  {
    key: "looks",
    href: "/settings/workspace/looks",
    icon: <Rows3Icon />,
    group: "settings",
  },
  {
    key: "accountSettings",
    href: "/settings/account",
    icon: <UserRoundIcon />,
    group: "settings",
  },
];

const EMPTY_RESULTS: QuickSearchResult = { invoices: [], clients: [] };

/** Strips diacritics so "faktura" matches "Faktúra" and "ucet" matches "účet". */
function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

interface Row {
  id: string;
  href: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
}

export function CommandPalette() {
  const t = useTranslations("App.palette");
  const tNav = useTranslations("App.nav");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] =
    React.useState<QuickSearchResult>(EMPTY_RESULTS);
  const [searching, setSearching] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      setOpen((previous) => !previous);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function setOpenState(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResults(EMPTY_RESULTS);
      setSearching(false);
      setActiveIndex(0);
    }
  }

  const trimmedQuery = query.trim();
  const searchable = trimmedQuery.length >= 2;

  // Debounced: every keystroke would otherwise be a round trip to the database.
  React.useEffect(() => {
    if (!searchable) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      setSearching(true);
      quickSearchAction(trimmedQuery)
        .then((next) => {
          if (!cancelled) setResults(next);
        })
        .catch(() => {
          if (!cancelled) setResults(EMPTY_RESULTS);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [searchable, trimmedQuery]);

  const staticRows = React.useMemo<Row[]>(() => {
    const folded = fold(query.trim());
    return STATIC_COMMANDS.filter((command) => {
      if (!folded) return true;
      return fold(t(`commands.${command.key}`)).includes(folded);
    }).map((command) => ({
      id: `static:${command.key}`,
      href: command.href,
      icon: command.icon,
      label: t(`commands.${command.key}`),
      hint: t(`groups.${command.group}`),
    }));
  }, [query, t]);

  // Results from the previous query stay in state while a new one is in flight;
  // gating on `searchable` keeps stale rows out of an emptied input.
  const recordRows = React.useMemo<Row[]>(
    () =>
      !searchable
        ? []
        : [
            ...results.invoices.map((invoice) => ({
              id: `invoice:${invoice.id}`,
              href: `/invoices/${invoice.id}`,
              icon: <FileTextIcon />,
              label: invoice.number ?? tNav("invoices"),
              hint: `${invoice.clientName} · ${formatMoney(
                Number(invoice.total),
                invoice.currency,
                locale,
              )}`,
            })),
            ...results.clients.map((client) => ({
              id: `client:${client.id}`,
              href: `/clients/${client.id}/edit`,
              icon: <UsersIcon />,
              label: client.name,
              hint: client.ico ?? undefined,
            })),
          ],
    [locale, results, searchable, tNav],
  );

  const rows = React.useMemo(
    () => [...recordRows, ...staticRows],
    [recordRows, staticRows],
  );

  /** Derived, not stored: the row count shrinks as the query narrows. */
  const selectedIndex = rows.length
    ? Math.min(activeIndex, rows.length - 1)
    : 0;

  function go(row: Row | undefined) {
    if (!row) return;
    setOpenState(false);
    router.push(row.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex(rows.length ? (selectedIndex + 1) % rows.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        rows.length ? (selectedIndex - 1 + rows.length) % rows.length : 0,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(rows[selectedIndex]);
    }
  }

  return (
    <>
      <button
        aria-keyshortcuts="Meta+K Control+K"
        className="flex h-8 items-center gap-2 rounded-md border px-2.5 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring max-sm:size-10 max-sm:justify-center max-sm:border-0 max-sm:px-0"
        onClick={() => setOpenState(true)}
        type="button"
      >
        <SearchIcon className="size-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">{t("trigger")}</span>
        <Kbd className="ml-4 hidden sm:inline-flex">⌘K</Kbd>
        <span className="sr-only sm:hidden">{t("trigger")}</span>
      </button>

      <Dialog.Root open={open} onOpenChange={setOpenState}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
          <Dialog.Popup className="fixed top-[max(1rem,env(safe-area-inset-top))] left-1/2 z-50 w-[min(36rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-xl border bg-popover shadow-2xl transition-opacity outline-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 sm:top-[12vh] sm:w-[min(36rem,calc(100vw-2rem))]">
            <Dialog.Title className="sr-only">{t("title")}</Dialog.Title>
            <Dialog.Description className="sr-only">
              {t("description")}
            </Dialog.Description>
            <div className="flex items-center gap-2 border-b px-3">
              <SearchIcon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <input
                aria-label={t("title")}
                autoFocus
                className="h-12 w-full bg-transparent text-base text-ellipsis outline-none placeholder:text-muted-foreground sm:text-sm"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={t("placeholder")}
                value={query}
              />
              {searching ? (
                <LoaderCircleIcon className="size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : null}
            </div>
            <div className="max-h-[calc(100svh-8rem)] overflow-y-auto overscroll-contain p-1.5 sm:max-h-[min(24rem,60vh)]">
              {rows.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </p>
              ) : (
                <ul role="listbox" aria-label={t("title")}>
                  {rows.map((row, index) => (
                    <li key={row.id}>
                      <button
                        aria-selected={index === selectedIndex}
                        className={cn(
                          "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors sm:min-h-0",
                          index === selectedIndex
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted/60",
                        )}
                        onClick={() => go(row)}
                        onMouseEnter={() => setActiveIndex(index)}
                        role="option"
                        type="button"
                      >
                        <span className="text-muted-foreground [&_svg]:size-4">
                          {row.icon}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-foreground">
                          {row.label}
                        </span>
                        {row.hint ? (
                          <span className="max-w-[45%] truncate text-xs text-muted-foreground">
                            {row.hint}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
