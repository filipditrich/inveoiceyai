import { Button } from "@/components/ui/button";
import { isAppLocale, type AppLocale } from "@/i18n/config";
import {
  formatInvoiceDate,
  formatMoney,
  formatMoneyByCurrency,
} from "@/lib/format";
import { DISPLAY_STATUS_CARD_ACCENT } from "@/lib/invoice-status-ui";
import { cn } from "@/lib/utils";
import {
  CircleCheckIcon,
  FilePenLineIcon,
  LandmarkIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import type { DashboardAttentionKind } from "@/lib/dashboard-attention";
import type {
  AttentionInvoice,
  DashboardAttention as DashboardAttentionModel,
} from "@/lib/dashboard-metrics";

const ACTION_ACCENT = {
  overdue: DISPLAY_STATUS_CARD_ACCENT.overdue,
  unpaid: DISPLAY_STATUS_CARD_ACCENT.unpaid,
  drafts: DISPLAY_STATUS_CARD_ACCENT.draft,
  matches: "text-foreground",
} as const;

const ACTION_ICON = {
  overdue: TriangleAlertIcon,
  unpaid: TriangleAlertIcon,
  drafts: FilePenLineIcon,
  matches: LandmarkIcon,
} as const;

export async function DashboardAttention({
  attention,
}: {
  attention: DashboardAttentionModel;
}) {
  const t = await getTranslations("Dashboard.attention");
  const localeValue = await getLocale();
  const locale = isAppLocale(localeValue) ? localeValue : "cs";

  function titleFor(kind: DashboardAttentionKind, count: number): string {
    switch (kind) {
      case "overdue":
        return t("overdue", { count });
      case "unpaid":
        return t("unpaid", { count });
      case "drafts":
        return t("drafts", { count });
      case "matches":
        return t("matches", { count });
    }
  }

  function ctaFor(kind: DashboardAttentionKind): string {
    switch (kind) {
      case "overdue":
        return t("cta.overdue");
      case "unpaid":
        return t("cta.unpaid");
      case "drafts":
        return t("cta.drafts");
      case "matches":
        return t("cta.matches");
    }
  }

  if (attention.actions.length === 0) {
    return (
      <section className="rounded-lg border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <CircleCheckIcon
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            />
            <div>
              <h2 className="text-sm font-medium">{t("clearTitle")}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("clearDescription")}
              </p>
            </div>
          </div>
          <Button render={<Link href="/invoices/new" prefetch />} size="sm">
            {t("createInvoice")}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card px-4 py-3">
      <h2 className="text-sm font-medium">{t("title")}</h2>
      <ul className="mt-3 space-y-3">
        {attention.actions.map((action) => {
          const Icon = ACTION_ICON[action.kind];
          return (
            <li key={action.kind}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0",
                      ACTION_ACCENT[action.kind],
                    )}
                  />
                  <p className="text-sm">
                    <span
                      className={cn("font-medium", ACTION_ACCENT[action.kind])}
                    >
                      {titleFor(action.kind, action.count)}
                    </span>
                    {Object.keys(action.totalsByCurrency).length > 0 ? (
                      <span className="text-muted-foreground">
                        {" · "}
                        {formatMoneyByCurrency(action.totalsByCurrency, locale)}
                      </span>
                    ) : null}
                  </p>
                </div>
                <Button
                  render={<Link href={action.href} prefetch />}
                  size="sm"
                  variant="outline"
                >
                  {ctaFor(action.kind)}
                </Button>
              </div>
              {action.kind === "overdue" ? (
                <OverduePreview
                  draftLabel={t("draft")}
                  dueLabel={t("due")}
                  locale={locale}
                  rows={attention.overduePreview}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function OverduePreview({
  rows,
  locale,
  draftLabel,
  dueLabel,
}: {
  rows: AttentionInvoice[];
  locale: AppLocale;
  draftLabel: string;
  dueLabel: string;
}) {
  if (rows.length === 0) return null;

  return (
    <ul className="mt-2 divide-y rounded-md border">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2 text-sm hover:bg-muted/40"
            href={`/invoices/${row.id}`}
          >
            <span className="min-w-0 truncate font-medium">
              {row.number ?? draftLabel}
              <span className="font-normal text-muted-foreground">
                {" · "}
                {row.clientName}
              </span>
            </span>
            <span className="text-muted-foreground tabular-nums">
              {formatMoney(
                Number(row.total) || 0,
                row.currency || "CZK",
                locale,
              )}
              {" · "}
              {dueLabel} {formatInvoiceDate(row.dueDate, locale)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
