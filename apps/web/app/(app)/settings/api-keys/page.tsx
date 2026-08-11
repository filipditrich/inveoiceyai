import { ApiKeysPanel } from "@/components/settings/api-keys-panel";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { env } from "@invoicey/env/server";
import { KeyRoundIcon } from "lucide-react";

export default function SettingsApiKeysPage() {
  const appUrl = (env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL).replace(
    /\/$/,
    "",
  );
  return (
    <div className="space-y-6">
      <SettingsPageHeader
        description="Vytvářejte osobní přístupové klíče pro remote MCP. Každý klíč má plný přístup k vašemu výchozímu pracovnímu prostoru."
        icon={<KeyRoundIcon />}
        title="API klíče"
      />
      <ApiKeysPanel appUrl={appUrl} />
    </div>
  );
}
