import { headers } from "next/headers";

import {
  LinkedAccountsPanel,
  SecurityAuditPanel,
  SessionsPanel,
  TrustedDevicesPanel,
} from "@/components/settings/security-panels";
import { auth } from "@/lib/auth/auth";
import { env } from "@invoicey/env/server";

export default async function SettingsSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ trust?: string; linked?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  const configuredProviders: Array<"google" | "github"> = [];
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    configuredProviders.push("google");
  }
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    configuredProviders.push("github");
  }

  return (
    <div className="flex flex-col gap-6">
      {sp.trust === "ok" ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Zařízení bylo označeno jako důvěryhodné.
        </p>
      ) : null}
      {sp.trust === "invalid" ? (
        <p className="text-destructive text-sm">
          Odkaz pro důvěru zařízení je neplatný nebo vypršel.
        </p>
      ) : null}
      <LinkedAccountsPanel configuredProviders={configuredProviders} />
      <SessionsPanel
        currentToken={session?.session.token}
        revokeOthersOnMount={sp.linked === "1"}
      />
      <TrustedDevicesPanel />
      <SecurityAuditPanel />
    </div>
  );
}
