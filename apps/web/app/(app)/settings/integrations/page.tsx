import { IntegrationsPanels } from "@/components/settings/integrations-panels";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { PlugZapIcon } from "lucide-react";

export default function SettingsIntegrationsPage() {
  return (
    <div className="space-y-6">
      <SettingsPageHeader
        description="Propojte Invoicey se Slackem, Cursorem nebo Claude Code. Citlivé operace zůstávají pod vaším potvrzením."
        icon={<PlugZapIcon />}
        title="Integrace a automatizace"
      />
      <IntegrationsPanels />
    </div>
  );
}
