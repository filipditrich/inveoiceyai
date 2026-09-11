import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { PocketConnectClient } from "@/components/pocket/pocket-connect-client";
import { SignedInUserRow } from "@/components/settings/slack-connection-parties";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getOptionalSession } from "@/lib/auth/session";
import { isPocketPkceChallenge } from "@/lib/pocket/crypto";
import { isAllowedPocketRedirect } from "@/lib/pocket/redirect";
import { TriangleAlertIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { listMemberWorkspaces } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

export default async function PocketConnectPage({
  searchParams,
}: {
  searchParams: Promise<{
    challenge?: string;
    redirect?: string;
    device?: string;
  }>;
}) {
  const query = await searchParams;
  const session = await getOptionalSession();
  const nextQuery = new URLSearchParams();
  if (query.challenge) nextQuery.set("challenge", query.challenge);
  if (query.redirect) nextQuery.set("redirect", query.redirect);
  if (query.device) nextQuery.set("device", query.device);
  const next = `/pocket/connect?${nextQuery.toString()}`;
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  const t = await getTranslations("PocketConnect");
  const challenge = query.challenge?.trim() ?? "";
  const redirectUri = query.redirect?.trim() ?? "";
  const deviceName = query.device?.trim().slice(0, 80) || null;
  const valid =
    isPocketPkceChallenge(challenge) &&
    isAllowedPocketRedirect(redirectUri, env.NEXT_PUBLIC_APP_URL);
  const workspaces = valid ? await listMemberWorkspaces(db, session.id) : [];
  const canAct = valid && workspaces.length > 0;

  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <div className="marketing-grid pointer-events-none absolute inset-0 opacity-[0.28]" />
      <header className="relative flex items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 rounded-xl">
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
            {!canAct ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
              >
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                <p>{t("invalid")}</p>
              </div>
            ) : null}
          </CardContent>
          <CardFooter>
            <PocketConnectClient
              canAct={canAct}
              challenge={challenge}
              deviceName={deviceName}
              redirectUri={redirectUri}
              workspaces={workspaces}
            />
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
