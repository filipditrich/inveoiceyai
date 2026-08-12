import { ApiKeysDefaultWorkspacePanel } from "@/components/settings/api-keys-default-workspace-panel";
import { ApiKeysPanel } from "@/components/settings/api-keys-panel";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { requireSession, requireWorkspace } from "@/lib/auth/session";
import {
  getUserDefaultWorkspaceId,
  listUserWorkspaces,
} from "@/lib/auth/workspaces";
import { env } from "@invoicey/env/server";
import { KeyRoundIcon } from "lucide-react";

export default async function SettingsApiKeysPage() {
  const { workspaceId } = await requireWorkspace();
  const user = await requireSession();
  const [workspaces, defaultWorkspaceId] = await Promise.all([
    listUserWorkspaces(user.id),
    getUserDefaultWorkspaceId(user.id),
  ]);
  const appUrl = (env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL).replace(
    /\/$/,
    "",
  );

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        description="Vytvářejte osobní přístupové klíče pro remote MCP. Každý klíč používá váš výchozí pracovní prostor (níže)."
        icon={<KeyRoundIcon />}
        title="API klíče"
      />
      <ApiKeysDefaultWorkspacePanel
        activeWorkspaceId={workspaceId}
        defaultWorkspaceId={defaultWorkspaceId}
        workspaces={workspaces}
      />
      <ApiKeysPanel appUrl={appUrl} />
    </div>
  );
}
