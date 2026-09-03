import { AdminMonthlyChart } from "@/components/admin/admin-monthly-chart";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadPlatformDashboardMetrics } from "@/lib/admin/metrics";
import { formatTokenCount } from "@/lib/ai/format-tokens";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { formatMoney, formatMoneyByCurrency } from "@/lib/format";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import type { AppLocale } from "@/i18n/config";

export default async function AdminDashboardPage() {
  await requirePlatformAdmin();
  const t = await getTranslations("Admin.dashboard");
  const tStatus = await getTranslations("Status.invoice");
  /** SAFETY: request config constrains next-intl locale to AppLocale. */
  const locale = (await getLocale()) as AppLocale;
  const metrics = await loadPlatformDashboardMetrics();

  const volumeHint = formatMoneyByCurrency(
    Object.fromEntries(
      metrics.issuedVolumeByCurrency.map((row) => [row.currency, row.volume]),
    ),
    locale,
  );

  const summaryCards = [
    {
      label: t("cards.users"),
      value: String(metrics.userCount),
      href: "/admin/users",
      hint: t("cards.adminsHint", {
        count: String(metrics.platformAdminCount),
      }),
    },
    {
      label: t("cards.workspaces"),
      value: String(metrics.workspaceCount),
      href: "/admin/workspaces",
    },
    {
      label: t("cards.invoices"),
      value: String(metrics.invoiceCount),
      href: "/admin/invoices",
      hint: t("cards.issuedHint", {
        count: String(metrics.issuedCount12m),
        volume: volumeHint,
      }),
    },
    {
      label: t("cards.issuers"),
      value: String(metrics.issuerCount),
      href: "/admin/issuers",
    },
    {
      label: t("cards.ai"),
      value: formatTokenCount(metrics.aiRemaining),
      href: "/admin/ai",
      hint: t("cards.aiHint", { burn: formatTokenCount(metrics.aiBurn30d) }),
    },
  ] as const;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader description={t("subtitle")} title={t("title")} />

      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-3 @7xl/main:grid-cols-5">
        {summaryCards.map((card) => (
          <Link
            className="block transition-opacity hover:opacity-90"
            href={card.href}
            key={card.href}
            prefetch
          >
            <Card className="h-full">
              <CardHeader>
                <CardDescription>{card.label}</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">
                  {card.value}
                </CardTitle>
                {"hint" in card && card.hint ? (
                  <p className="text-xs text-muted-foreground">{card.hint}</p>
                ) : null}
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <AdminMonthlyChart data={metrics.monthly} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-medium">{t("volumeTitle")}</h2>
          {metrics.issuedVolumeByCurrency.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("volumeEmpty")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {metrics.issuedVolumeByCurrency.map((row) => (
                <Card key={row.currency}>
                  <CardHeader className="gap-1">
                    <CardDescription>{row.currency}</CardDescription>
                    <CardTitle className="text-xl tabular-nums">
                      {formatMoney(row.volume, row.currency, locale)}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {row.count}
                    </p>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
        <div>
          <h2 className="mb-3 text-lg font-medium">{t("plansTitle")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {metrics.planMix.map((row) => (
              <Link
                className="block transition-opacity hover:opacity-90"
                href={`/admin/plans/${row.planId}`}
                key={row.planId}
                prefetch
              >
                <Card>
                  <CardHeader className="gap-1">
                    <CardDescription>{row.planName}</CardDescription>
                    <CardTitle className="text-xl tabular-nums">
                      {row.workspaceCount}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">{t("healthTitle")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader className="gap-1">
              <CardDescription>{t("health.email")}</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {metrics.emailBounce7d + metrics.emailComplaint7d}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {t("health.emailHint", {
                  bounces: String(metrics.emailBounce7d),
                  complaints: String(metrics.emailComplaint7d),
                })}
              </p>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="gap-1">
              <CardDescription>{t("health.banks")}</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {metrics.bankErrorCount}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {t("health.banksHint", {
                  errors: String(metrics.bankErrorCount),
                  total: String(metrics.bankConnectionCount),
                })}
              </p>
            </CardHeader>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">{t("statusTitle")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {metrics.buckets.map((b) => (
            <Card key={b.status}>
              <CardHeader className="gap-1">
                <CardDescription>{tStatus(b.status)}</CardDescription>
                <CardTitle className="text-xl tabular-nums">
                  {b.count}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium">{t("recentTitle")}</h2>
        {metrics.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("recentEmpty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">
                    {t("recent.number")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("recent.client")}
                  </th>
                  <th className="px-3 py-2 font-medium">
                    {t("recent.workspace")}
                  </th>
                  <th className="px-3 py-2 font-medium">{t("recent.total")}</th>
                  <th className="px-3 py-2 font-medium">
                    {t("recent.status")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.recent.map((row) => (
                  <tr className="border-t" key={row.id}>
                    <td className="px-3 py-2 tabular-nums">
                      <Link
                        className="font-medium hover:underline"
                        href={`/admin/invoices/${row.id}`}
                      >
                        {row.number ?? "—"}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{row.clientName}</td>
                    <td className="px-3 py-2">
                      <Link
                        className="hover:underline"
                        href={`/admin/workspaces/${row.workspaceId}`}
                      >
                        {row.workspaceName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatMoney(
                        Number(row.total) || 0,
                        row.currency,
                        locale,
                      )}
                    </td>
                    <td className="px-3 py-2">{tStatus(row.displayStatus)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
