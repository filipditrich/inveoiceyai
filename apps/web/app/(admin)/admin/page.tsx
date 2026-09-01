import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadPlatformDashboardMetrics } from "@/lib/admin/metrics";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import type { AppLocale } from "@/i18n/config";

export default async function AdminDashboardPage() {
  await requirePlatformAdmin();
  const t = await getTranslations("Admin.dashboard");
  const tStatus = await getTranslations("Status.invoice");
  const locale = (await getLocale()) as AppLocale;
  const metrics = await loadPlatformDashboardMetrics();

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
        volume: formatMoney(metrics.issuedVolume12m, "CZK", locale),
      }),
    },
    {
      label: t("cards.issuers"),
      value: String(metrics.issuerCount),
      href: "/admin/issuers",
    },
  ] as const;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader description={t("subtitle")} title={t("title")} />

      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
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
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatMoney(b.total, "CZK", locale)}
                </p>
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
                      {row.number ?? "—"}
                    </td>
                    <td className="px-3 py-2">{row.clientName}</td>
                    <td className="px-3 py-2">{row.workspaceName}</td>
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
