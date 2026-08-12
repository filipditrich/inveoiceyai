import { getSlackLinkCode, getWorkspaceName } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { SlackLinkConfirmClient } from "@/components/settings/slack-link-confirm-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {row ? (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">{t("slackUser")}</dt>
                <dd className="font-medium">
                  {row.slackUserName?.trim() || row.slackUserId}
                  <span className="text-muted-foreground block text-xs font-normal">
                    {row.slackTeamId} / {row.slackUserId}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("workspace")}</dt>
                <dd className="font-medium">{workspaceName}</dd>
              </div>
            </dl>
          ) : null}

          <p className="text-muted-foreground text-xs">
            {t("signedInAs", { email: session.user.email })}
          </p>
          {canAct ? (
            <p className="text-muted-foreground text-sm">
              {t("workspaceHint")}
            </p>
          ) : null}

          {state === "not_found" ? (
            <p className="text-destructive text-sm">{t("notFound")}</p>
          ) : null}
          {state === "expired" ? (
            <p className="text-destructive text-sm">{t("expired")}</p>
          ) : null}
          {state === "consumed" ? (
            <p className="text-destructive text-sm">{t("consumed")}</p>
          ) : null}

          <SlackLinkConfirmClient code={code} canAct={canAct} />
          <Button
            variant="ghost"
            render={<Link href="/settings/integrations" />}
          >
            {t("backToApp")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
