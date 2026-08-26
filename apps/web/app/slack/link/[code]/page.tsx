import { getSlackLinkCode, getWorkspaceName } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { ClockIcon, InfoIcon, TriangleAlertIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import {
  SignedInUserRow,
  SlackConnectionParties,
} from "@/components/settings/slack-connection-parties";
import { SlackLinkConfirmClient } from "@/components/settings/slack-link-confirm-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth/auth";
import { requireWorkspace } from "@/lib/auth/session";
import { resolveSlackLinkViewState } from "@/lib/slack/link-view-state";

export default async function SlackLinkPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const t = await getTranslations("SlackLink");
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(`/sign-in?next=${encodeURIComponent(`/slack/link/${code}`)}`);
  }

  const workspace = await requireWorkspace();
  const row = await getSlackLinkCode(db, code);
  const state = resolveSlackLinkViewState(row);
  const workspaceName =
    (await getWorkspaceName(db, workspace.workspaceId)) ??
    workspace.workspaceId;
  const canAct = state === "pending";
  const slackTitle = row?.slackUserName?.trim() || t("slackAccount");
  const slackCaption = row
    ? row.slackUserName?.trim()
      ? row.slackUserId
      : `${row.slackTeamId} · ${row.slackUserId}`
    : undefined;

  return (
    <div className="bg-background relative flex min-h-svh flex-col">
      <div className="marketing-grid pointer-events-none absolute inset-0 opacity-[0.28]" />
      <header className="relative flex items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="focus-visible:ring-3 focus-visible:ring-ring/50 flex items-center gap-2.5 rounded-xl outline-none"
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
            {row ? (
              <SlackConnectionParties
                stacked
                slackCaption={slackCaption}
                slackEyebrow={t("fromSlack")}
                slackTitle={slackTitle}
                workspaceCaption={t("invoicesLandHere")}
                workspaceEyebrow={t("toWorkspace")}
                workspaceTitle={workspaceName}
              />
            ) : null}

            <SignedInUserRow
              email={session.user.email}
              image={session.user.image}
              label={t("invoiceyAccount")}
              name={session.user.name}
            />

            {canAct ? (
              <div
                role="note"
                className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm"
              >
                <InfoIcon className="mt-0.5 size-4 shrink-0 text-amber-800 dark:text-amber-300" />
                <div className="space-y-1 leading-relaxed">
                  <p className="font-medium text-amber-950 dark:text-amber-100">
                    {t("workspaceCalloutTitle")}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t("workspaceHint")}
                  </p>
                </div>
              </div>
            ) : null}

            {canAct ? (
              <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
                <ClockIcon className="mt-0.5 size-3.5 shrink-0" />
                {t("expiresNote")}
              </p>
            ) : null}

            {state === "not_found" ? (
              <LinkError message={t("notFound")} />
            ) : null}
            {state === "expired" ? <LinkError message={t("expired")} /> : null}
            {state === "consumed" ? (
              <LinkError message={t("consumed")} />
            ) : null}
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-2">
            <SlackLinkConfirmClient code={code} canAct={canAct} />
            <Button
              className="w-full"
              variant="ghost"
              render={<Link href="/settings/workspace/integrations" />}
            >
              {t("backToApp")}
            </Button>
          </CardFooter>
        </Card>
        {canAct ? (
          <p className="text-muted-foreground mx-auto mt-4 max-w-md text-center text-xs leading-relaxed">
            {t("noEmailMatch")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function LinkError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="border-destructive/25 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
    >
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
