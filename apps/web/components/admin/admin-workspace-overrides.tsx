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
}: {
  workspaceId: string;
  entitlements: Entitlements;
  hasOverrides: boolean;
}) {
  const t = await getTranslations("Admin.workspaceDetail.overrides");

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
        <div className="flex flex-wrap gap-2">
          <SubmitButton size="sm">{t("save")}</SubmitButton>
        </div>
      </form>
      {hasOverrides ? (
        <form action={clearWorkspaceOverridesAction} className="mt-4">
          <input name="workspaceId" type="hidden" value={workspaceId} />
          <SubmitButton size="sm" variant="outline">
            {t("clear")}
          </SubmitButton>
        </form>
      ) : null}
    </AdminSection>
  );
}
