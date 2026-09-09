import {
  clearWorkspaceOverridesAction,
  saveWorkspaceOverridesAction,
} from "@/actions/admin-control";
import { AdminSection } from "@/components/admin/admin-detail-kit";
import { AdminEntitlementFields } from "@/components/admin/admin-entitlement-fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { getTranslations } from "next-intl/server";

import type { Entitlements } from "@invoicey/db";

export async function AdminWorkspaceOverridesSection({
  workspaceId,
  entitlements,
  hasOverrides,
  billingAuthority = "manual",
}: {
  workspaceId: string;
  entitlements: Entitlements;
  hasOverrides: boolean;
  billingAuthority?: "manual" | "polar";
}) {
  const t = await getTranslations("Admin.workspaceDetail.overrides");
  const polarManaged = billingAuthority === "polar";

  return (
    <AdminSection description={t("description")} title={t("title")}>
      <form action={saveWorkspaceOverridesAction} className="space-y-6">
        <input name="workspaceId" type="hidden" value={workspaceId} />
        <input
          name="currentEntitlements"
          type="hidden"
          value={JSON.stringify(entitlements)}
        />
        <AdminEntitlementFields
          entitlements={entitlements}
          idPrefix="override-"
        />
        {polarManaged ? (
          <label className="flex items-start gap-2 text-sm">
            <input
              className="mt-1"
              name="detachPolar"
              type="checkbox"
              value="on"
            />
            <span>
              <span className="font-medium">{t("detachLabel")}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t("detachHint")}
              </span>
            </span>
          </label>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <SubmitButton size="sm">{t("save")}</SubmitButton>
        </div>
      </form>
      {hasOverrides ? (
        <form action={clearWorkspaceOverridesAction} className="mt-4 space-y-3">
          <input name="workspaceId" type="hidden" value={workspaceId} />
          {polarManaged ? (
            <label className="flex items-start gap-2 text-sm">
              <input
                className="mt-1"
                name="detachPolar"
                type="checkbox"
                value="on"
              />
              <span>
                <span className="font-medium">{t("detachLabel")}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t("detachHint")}
                </span>
              </span>
            </label>
          ) : null}
          <SubmitButton size="sm" variant="outline">
            {t("clear")}
          </SubmitButton>
        </form>
      ) : null}
    </AdminSection>
  );
}
