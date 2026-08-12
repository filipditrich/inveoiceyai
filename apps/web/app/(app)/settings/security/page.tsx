import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import {
  CheckCircle2Icon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react";

import {
  LinkedAccountsPanel,
  SecurityAuditPanel,
  SessionsPanel,
  TrustedDevicesPanel,
} from "@/components/settings/security-panels";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { auth } from "@/lib/auth/auth";
import { env } from "@invoicey/env/server";

export default async function SettingsSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ trust?: string; linked?: string }>;
}) {
  const sp = await searchParams;
  const t = await getTranslations("Settings.security");
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
      <SettingsPageHeader
        description={t("pageDescription")}
        icon={<ShieldCheckIcon />}
        title={t("pageTitle")}
      />

      {sp.trust === "ok" ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-300"
        >
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
          <p>{t("trustOk")}</p>
        </div>
      ) : null}
      {sp.trust === "invalid" ? (
        <div
          role="alert"
          className="border-destructive/25 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
        >
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <p>{t("trustInvalid")}</p>
        </div>
      ) : null}
      {sp.linked === "1" ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-300"
        >
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
          <p>{t("linkedAfter")}</p>
        </div>
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
