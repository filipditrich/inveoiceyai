import { AdminAiChart } from "@/components/admin/admin-ai-chart";
import {
  AdminEmpty,
  AdminFacts,
  AdminMiniTable,
  AdminSection,
} from "@/components/admin/admin-detail-kit";
import { PageHeader } from "@/components/layout/page-header";
import { loadPlatformAiUsage } from "@/lib/admin/ai";
import { formatTokenCount } from "@/lib/ai/format-tokens";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { SparklesIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";

import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminAiPage() {
  await requirePlatformAdmin();
  const [t, format] = await Promise.all([
    getTranslations("Admin.ai"),
    getFormatter(),
  ]);
  const usage = await loadPlatformAiUsage();
  const remainingTotal =
    usage.remainingGifted + usage.remainingMonthly + usage.remainingPurchased;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        description={t("subtitle")}
        icon={<SparklesIcon className="size-5" />}
        title={t("title")}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminSection title={t("remainingTitle")}>
          <AdminFacts
            items={[
              {
                label: t("facts.total"),
                value: formatTokenCount(remainingTotal),
              },
              {
                label: t("facts.gifted"),
                value: formatTokenCount(usage.remainingGifted),
              },
              {
                label: t("facts.monthly"),
                value: formatTokenCount(usage.remainingMonthly),
              },
              {
                label: t("facts.purchased"),
                value: formatTokenCount(usage.remainingPurchased),
              },
            ]}
          />
        </AdminSection>
        <AdminSection title={t("burnTitle")}>
          <AdminFacts
            items={[
              {
                label: t("burnTitle"),
                value: formatTokenCount(usage.burn30d),
              },
            ]}
          />
        </AdminSection>
      </div>

      <AdminSection description={t("chart.subtitle")} title={t("chart.title")}>
        <AdminAiChart data={usage.byDay} />
      </AdminSection>

      <AdminSection title={t("productTitle")}>
        {usage.byProduct.length === 0 ? (
          <AdminEmpty>{t("topEmpty")}</AdminEmpty>
        ) : (
          <AdminMiniTable
            headers={[
              t("columns.product"),
              t("columns.tokens"),
              t("columns.events"),
            ]}
            rows={usage.byProduct.map((row) => [
              t(`product.${row.product}`),
              formatTokenCount(row.tokens),
              format.number(row.events),
            ])}
          />
        )}
      </AdminSection>

      <AdminSection title={t("topTitle")}>
        {usage.topWorkspaces.length === 0 ? (
          <AdminEmpty>{t("topEmpty")}</AdminEmpty>
        ) : (
          <AdminMiniTable
            headers={[t("columns.workspace"), t("columns.tokens")]}
            rows={usage.topWorkspaces.map((row) => [
              <Link
                key={row.workspaceId}
                className="hover:underline"
                href={`/admin/workspaces/${row.workspaceId}`}
              >
                {row.workspaceName}
              </Link>,
              formatTokenCount(row.tokens),
            ])}
          />
        )}
      </AdminSection>

      <AdminSection title={t("grantsTitle")}>
        {usage.recentGrants.length === 0 ? (
          <AdminEmpty>{t("grantsEmpty")}</AdminEmpty>
        ) : (
          <AdminMiniTable
            headers={[
              t("columns.workspace"),
              t("columns.trigger"),
              t("columns.tokens"),
              t("columns.by"),
              t("columns.note"),
              t("columns.when"),
            ]}
            rows={usage.recentGrants.map((row) => [
              <Link
                key={row.id}
                className="hover:underline"
                href={`/admin/workspaces/${row.workspaceId}`}
              >
                {row.workspaceName}
              </Link>,
              t(`trigger.${row.trigger}`),
              formatTokenCount(row.tokens),
              row.grantedByEmail ?? "—",
              row.note ?? "—",
              <span key="at" className="whitespace-nowrap tabular-nums">
                {format.dateTime(row.createdAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>,
            ])}
          />
        )}
      </AdminSection>
    </div>
  );
}
