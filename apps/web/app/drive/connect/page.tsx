import { BrandLogo } from "@/components/brand-logo";
import { DriveConnectClient } from "@/components/drive/drive-connect-client";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignedInUserRow } from "@/components/settings/slack-connection-parties";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getOptionalSession } from "@/lib/auth/session";
import { isPkceChallenge } from "@/lib/drive/crypto";
import { isAllowedDriveRedirect } from "@/lib/drive/redirect";
import { InfoIcon, TriangleAlertIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { listMemberWorkspaces } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

export default async function DriveConnectPage({
  searchParams,
}: {
  searchParams: Promise<{
    challenge?: string;
    redirect?: string;
    device?: string;
  }>;
}) {
  const query = await searchParams;
  const t = await getTranslations("DriveConnect");
  const session = await getOptionalSession();
  const next = `/drive/connect?${new URLSearchParams({
    ...(query.challenge ? { challenge: query.challenge } : {}),
    ...(query.redirect ? { redirect: query.redirect } : {}),
    ...(query.device ? { device: query.device } : {}),
  }).toString()}`;
  if (!session) {
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }

  const challenge = query.challenge?.trim() ?? "";
  const redirectUri = query.redirect?.trim() ?? "";
  const deviceName = query.device?.trim().slice(0, 80) || null;
  const valid =
    isPkceChallenge(challenge) &&
    isAllowedDriveRedirect(redirectUri, env.NEXT_PUBLIC_APP_URL);
  const workspaces = valid ? await listMemberWorkspaces(db, session.id) : [];

  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <div className="marketing-grid pointer-events-none absolute inset-0 opacity-[0.28]" />
      <header className="relative flex items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrandLogo size={34} priority />
          <span className="font-semibold tracking-tight">Invoicey</span>
        </Link>
        <LocaleSwitcher size="sm" />
      </header>

      <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col justify-center p-6">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <SignedInUserRow
              email={session.email}
              image={session.image}
              label={t("invoiceyAccount")}
              name={session.name}
            />
            {deviceName ? (
              <p className="text-sm">{t("deviceName", { name: deviceName })}</p>
            ) : null}
            {valid && workspaces.length > 0 ? (
              <div
                role="note"
                className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm"
              >
                <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="space-y-1 leading-relaxed">
                  <p className="font-medium">{t("workspacesTitle")}</p>
                  <p className="text-xs text-muted-foreground">
                    {workspaces.map((workspace) => workspace.name).join(" · ")}
                  </p>
                </div>
              </div>
            ) : null}
            {!valid ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              >
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                <p>{t("invalid")}</p>
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-2">
            <DriveConnectClient
              canAct={valid}
              challenge={challenge}
              deviceName={deviceName}
              redirectUri={redirectUri}
            />
            <Button
              className="w-full"
              variant="ghost"
              render={<Link href="/settings/account/drive" />}
            >
              {t("backToSettings")}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
