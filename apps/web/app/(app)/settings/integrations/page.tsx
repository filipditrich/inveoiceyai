import { getWorkspaceName, listSlackIdentitiesForUser } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { PlugZapIcon } from "lucide-react";

import { IntegrationsPanels } from "@/components/settings/integrations-panels";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { requireWorkspace } from "@/lib/auth/session";

export default async function SettingsIntegrationsPage() {
  const { userId, workspaceId } = await requireWorkspace();
  const identities = await listSlackIdentitiesForUser(db, userId);
  const currentWorkspaceName =
    (await getWorkspaceName(db, workspaceId)) ?? workspaceId;

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        description="Propojte Invoicey se Slackem, Cursorem nebo Claude Code. Citlivé operace zůstávají pod vaším potvrzením."
        icon={<PlugZapIcon />}
        title="Integrace a automatizace"
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
