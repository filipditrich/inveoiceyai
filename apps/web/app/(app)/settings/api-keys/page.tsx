import { ApiKeysPanel } from "@/components/settings/api-keys-panel";
import { env } from "@invoicey/env/server";

export default function SettingsApiKeysPage() {
  const appUrl = (env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL).replace(
    /\/$/,
    "",
  );
  return <ApiKeysPanel appUrl={appUrl} />;
}
