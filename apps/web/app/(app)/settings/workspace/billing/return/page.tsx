import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/session";
import { getPolarCatalog } from "@/lib/billing/catalog";
import { getPolarClient } from "@/lib/billing/polar-client";
import { CircleCheckIcon, ClockIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { getWorkspaceBillingState } from "@invoicey/db";
import { db } from "@invoicey/db/client";

export default async function BillingReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout_id?: string }>;
}) {
  const { workspaceId } = await requireWorkspace();
  const t = await getTranslations("App.settings.billing.return");
  const { checkout_id: checkoutId } = await searchParams;

  const billing = await getWorkspaceBillingState(db, workspaceId);
  const catalog = getPolarCatalog();

  let checkoutStatus: string | null = null;
  if (catalog && checkoutId) {
    try {
      const checkout = await getPolarClient(catalog).checkouts.get({
        id: checkoutId,
      });
      checkoutStatus = checkout.status;
    } catch (error) {
      console.error("[billing] checkout lookup failed", error);
    }
  }

  const fulfilled = billing.subscription != null;
  const paid = checkoutStatus === "succeeded";

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        description={t("pageDescription")}
        icon={fulfilled || paid ? <CircleCheckIcon /> : <ClockIcon />}
        title={fulfilled || paid ? t("titleReady") : t("titlePending")}
      />
      <p className="text-sm text-muted-foreground">
        {fulfilled || paid ? t("fulfilled") : t("pending")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button render={<Link href="/settings/workspace/billing" />}>
          {t("back")}
        </Button>
        <Button
          variant="outline"
          render={<Link href="/settings/workspace/usage" />}
        >
          {t("usage")}
        </Button>
      </div>
    </div>
  );
}
