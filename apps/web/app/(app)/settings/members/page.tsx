import { env } from "@invoicey/env/server";

import { MembersPanel } from "@/components/settings/members-panel";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { requireWorkspace } from "@/lib/auth/session";
import { UsersRoundIcon } from "lucide-react";

export default async function SettingsMembersPage() {
  const ws = await requireWorkspace();
  const canManage = ws.role === "owner" || ws.role === "admin";
  const appOrigin = env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL;

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        description="Pozvěte kolegy a určete, kdo může spravovat pracovní prostor a fakturační data."
        icon={<UsersRoundIcon />}
        title="Členové a oprávnění"
      />
      <MembersPanel
        workspaceId={ws.workspaceId}
        canManage={canManage}
        appOrigin={appOrigin}
      />
    </div>
  );
}
