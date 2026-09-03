import { BillingPanels } from "@/components/settings/billing-panels";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { requireWorkspace } from "@/lib/auth/session";
import { can } from "@/lib/authz/can";
import { getPolarCatalog } from "@/lib/billing/catalog";
import { CreditCardIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  getWorkspaceBillingState,
  getWorkspaceEntitlements,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";

export default async function SettingsBillingPage() {
  const { workspaceId } = await requireWorkspace();
  const t = await getTranslations("App.settings.billing");

  const [entitlements, billing, canManage] = await Promise.all([
    getWorkspaceEntitlements(db, workspaceId),
    getWorkspaceBillingState(db, workspaceId),
    can("billing:manage"),
  ]);

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        description={t("pageDescription")}
        icon={<CreditCardIcon />}
        title={t("pageTitle")}
      />
      <BillingPanels
        state={{
          configured: getPolarCatalog() != null,
          canManage,
          topUpEnabled: entitlements?.entitlements.ai.topUpEnabled ?? false,
          planName: entitlements?.planName ?? t("plan.unknown"),
          planKey: entitlements?.planKey ?? "free",
          authority: billing.authority,
          subscriptionStatus: billing.subscription?.status ?? null,
          canceling: billing.canceling,
          pastDue: billing.pastDue,
          periodEndIso:
            billing.subscription?.currentPeriodEnd?.toISOString() ?? null,
        }}
      />
    </div>
  );
}
