import { env } from "@invoicey/env/server";

import { MembersPanel } from "@/components/settings/members-panel";
import { requireWorkspace } from "@/lib/auth/session";

export default async function SettingsMembersPage() {
  const ws = await requireWorkspace();
  const canManage = ws.role === "owner" || ws.role === "admin";
  const appOrigin = env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL;

  return (
    <MembersPanel
      workspaceId={ws.workspaceId}
      canManage={canManage}
      appOrigin={appOrigin}
    />
  );
}
