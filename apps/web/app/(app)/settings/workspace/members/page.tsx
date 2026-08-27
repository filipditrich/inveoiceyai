import { env } from "@invoicey/env/server";
import { getTranslations } from "next-intl/server";
import { UsersRoundIcon } from "lucide-react";

import { MembersPanel } from "@/components/settings/members-panel";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { requireWorkspace } from "@/lib/auth/session";

export default async function SettingsMembersPage() {
  const ws = await requireWorkspace();
  const t = await getTranslations("Settings.members");
  const canManage = ws.role === "owner" || ws.role === "admin";
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
        appOrigin={appOrigin}
      />
    </div>
  );
}
