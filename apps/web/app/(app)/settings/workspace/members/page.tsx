import { env } from "@invoicey/env/server";
import { getTranslations } from "next-intl/server";
import { UsersRoundIcon } from "lucide-react";

import { MemberPermissionsSection } from "@/components/settings/member-permissions-section";
import { MembersPanel } from "@/components/settings/members-panel";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { requireWorkspace } from "@/lib/auth/session";
import { can } from "@/lib/authz/can";
import { requireEntitlements } from "@/lib/entitlements/entitlements";

export default async function SettingsMembersPage() {
  const ws = await requireWorkspace();
  const t = await getTranslations("Settings.members");
  // Read from the permission catalog rather than the role rank, so a preset or
  // a per-member override actually takes effect here (ADR 0038).
  const [canManage, { entitlements }] = await Promise.all([
    can("members:manage"),
    requireEntitlements(),
  ]);
  const seatLimit = entitlements.seats.max;
  const appOrigin = env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL;

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        description={t("pageDescription")}
        icon={<UsersRoundIcon />}
        title={t("pageTitle")}
      />
      <MembersPanel
        workspaceId={ws.workspaceId}
        canManage={canManage}
        seatLimit={seatLimit}
        appOrigin={appOrigin}
      />
      {/* Only offered when the plan includes per-member permissions; the
          action re-checks, so hiding is convenience, not enforcement. */}
      {canManage && entitlements.permissions.mode === "advanced" ? (
        <MemberPermissionsSection workspaceId={ws.workspaceId} />
      ) : null}
    </div>
  );
}
