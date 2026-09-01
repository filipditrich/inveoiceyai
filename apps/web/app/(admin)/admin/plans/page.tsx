import {
  AdminMiniTable,
  AdminSection,
} from "@/components/admin/admin-detail-kit";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { adminListPlans } from "@/lib/admin/plans";
import { formatTokenCount } from "@/lib/ai/format-tokens";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { LayersIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminPlansPage() {
  await requirePlatformAdmin();
  const [t, plans] = await Promise.all([
    getTranslations("Admin.plans"),
    adminListPlans(),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        description={t("subtitle")}
        eyebrow={t("eyebrow")}
        icon={<LayersIcon className="size-5" />}
        title={t("title")}
      />

      <AdminSection description={t("hint")} title={t("title")}>
        <AdminMiniTable
          headers={[
            t("columns.name"),
            t("columns.workspaces"),
            t("columns.seats"),
            t("columns.monthlyTokens"),
            t("columns.clients"),
            t("columns.domains"),
          ]}
          rows={plans.map((plan) => [
            <div key="name" className="flex flex-wrap items-center gap-2">
              <Link
                className="font-medium hover:underline"
                href={`/admin/plans/${plan.id}`}
              >
                {plan.name}
              </Link>
              {plan.isDefault ? (
                <Badge variant="secondary">{t("badges.default")}</Badge>
              ) : null}
              {plan.kind === "custom" ? (
                <Badge variant="outline">{t("badges.custom")}</Badge>
              ) : null}
              {plan.archivedAt ? (
                <Badge variant="outline">{t("badges.archived")}</Badge>
              ) : null}
            </div>,
            plan.workspaceCount,
            plan.entitlements.seats.max ?? t("unlimited"),
            formatTokenCount(plan.entitlements.ai.monthlyIncludedTokens),
            t(`clientMode.${plan.entitlements.clients.createMode}`),
            plan.autoAssignEmailDomains.join(", ") || "—",
          ])}
        />
      </AdminSection>
    </div>
  );
}
