import { AiUsagePanels } from "@/components/settings/ai-usage-panels";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { requireWorkspace } from "@/lib/auth/session";
import {
  MONTHLY_INCLUDED_TOKENS,
  aggregateAiUsageByDay,
  getWorkspaceTokenSummary,
  listAiUsageEvents,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { ActivityIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function SettingsUsagePage() {
  const { workspaceId } = await requireWorkspace();
  const t = await getTranslations("App.settings.usage");

  const [summary, chart, history] = await Promise.all([
    getWorkspaceTokenSummary(db, workspaceId),
    aggregateAiUsageByDay(db, { workspaceId, days: 30 }),
    listAiUsageEvents(db, { workspaceId, limit: 40 }),
  ]);

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        description={t("pageDescription")}
        icon={<ActivityIcon />}
        title={t("pageTitle")}
      />
      <AiUsagePanels
        balance={{
          giftedRemaining: summary.giftedRemaining,
          monthlyRemaining: summary.monthlyRemaining,
          monthlyLimit: summary.monthlyLimit,
          purchasedRemaining: summary.purchasedRemaining,
          totalAvailable: summary.totalAvailable,
          daysUntilRenewal: summary.daysUntilRenewal,
          periodEndIso: summary.periodEnd.toISOString(),
          monthlyIncluded: MONTHLY_INCLUDED_TOKENS,
        }}
        chart={chart}
        history={history.map((row) => ({
          id: row.id,
          product: row.product,
          kind: row.kind,
          model: row.model,
          totalTokens: row.totalTokens,
          toolName: row.toolName,
          createdAtIso: row.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
