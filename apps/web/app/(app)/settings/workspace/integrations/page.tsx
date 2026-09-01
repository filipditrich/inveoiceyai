import { IntegrationsPanels } from "@/components/settings/integrations-panels";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { requireWorkspace } from "@/lib/auth/session";
import { PlugZapIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { getWorkspaceName, listSlackIdentitiesForUser } from "@invoicey/db";
import { db } from "@invoicey/db/client";

export default async function SettingsIntegrationsPage() {
  const t = await getTranslations("Settings.integrations");
  const { userId, workspaceId } = await requireWorkspace();
  const identities = await listSlackIdentitiesForUser(db, userId);
  const currentWorkspaceName =
    (await getWorkspaceName(db, workspaceId)) ?? workspaceId;

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        description={t("pageDescription")}
        icon={<PlugZapIcon />}
        title={t("pageTitle")}
      />
      <IntegrationsPanels
        currentWorkspaceId={workspaceId}
        currentWorkspaceName={currentWorkspaceName}
        slackIdentities={identities.map((row) => ({
          slackTeamId: row.slackTeamId,
          slackUserId: row.slackUserId,
          workspaceId: row.workspaceId,
          workspaceName: row.workspaceName,
        }))}
      />
    </div>
  );
}
