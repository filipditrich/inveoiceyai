"use client";

import { useState, useTransition } from "react";
import {
  rebindSlackIdentityAction,
  unlinkSlackIdentityAction,
} from "@/actions/slack-link";
import { SlackConnectionParties } from "@/components/settings/slack-connection-parties";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link2Icon, MessageSquareIcon, UnlinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export type SlackIdentityView = {
  slackTeamId: string;
  slackUserId: string;
  workspaceId: string;
  workspaceName: string;
};

export function SlackIdentitiesPanel({
  identities,
  currentWorkspaceId,
  currentWorkspaceName,
}: {
  identities: SlackIdentityView[];
  currentWorkspaceId: string;
  currentWorkspaceName: string;
}) {
  const t = useTranslations("Settings.integrations.slackIdentity");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const keyOf = (row: SlackIdentityView) =>
    `${row.slackTeamId}:${row.slackUserId}`;

  const unlink = (row: SlackIdentityView) => {
    setBusyKey(`unlink:${keyOf(row)}`);
    startTransition(async () => {
      try {
        const result = await unlinkSlackIdentityAction({
          slackTeamId: row.slackTeamId,
          slackUserId: row.slackUserId,
        });
        if (!result.ok) {
          toast.error(t("unlinkFailed"));
          return;
        }
        toast.success(t("unlinkSuccess"));
        router.refresh();
      } finally {
        setBusyKey(null);
      }
    });
  };

  const rebind = (row: SlackIdentityView) => {
    setBusyKey(`rebind:${keyOf(row)}`);
    startTransition(async () => {
      try {
        const result = await rebindSlackIdentityAction({
          slackTeamId: row.slackTeamId,
          slackUserId: row.slackUserId,
        });
        if (!result.ok) {
          toast.error(t("rebindFailed"));
          return;
        }
        toast.success(t("rebindSuccess"));
        router.refresh();
      } finally {
        setBusyKey(null);
      }
    });
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Link2Icon className="size-4 text-muted-foreground" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        {identities.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-muted">
              <MessageSquareIcon className="size-5 text-muted-foreground" />
            </span>
            <p className="font-medium">{t("emptyTitle")}</p>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t("empty")}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {identities.map((row) => {
              const sameWorkspace = row.workspaceId === currentWorkspaceId;
              return (
                <li
                  key={keyOf(row)}
                  className="overflow-hidden rounded-xl border"
                >
                  <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
                    <Badge variant="secondary">{t("connected")}</Badge>
                    {sameWorkspace ? (
                      <span className="text-xs text-muted-foreground">
                        {t("currentWorkspace")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("otherWorkspace")}
                      </span>
                    )}
                  </div>
                  <div className="px-3 py-3">
                    <SlackConnectionParties
                      slackCaption={`${t("team", { id: row.slackTeamId })} · ${row.slackUserId}`}
                      slackEyebrow={t("fromSlack")}
                      slackTitle={t("slackAccount")}
                      workspaceCaption={t("invoicesGoTo")}
                      workspaceEyebrow={t("toWorkspace")}
                      workspaceTitle={row.workspaceName}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t px-3 py-2.5">
                    {sameWorkspace ? null : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        loading={busyKey === `rebind:${keyOf(row)}`}
                        onClick={() => rebind(row)}
                      >
                        {t("useCurrentWorkspace", {
                          name: currentWorkspaceName,
                        })}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      loading={busyKey === `unlink:${keyOf(row)}`}
                      onClick={() => unlink(row)}
                    >
                      <UnlinkIcon data-icon="inline-start" />
                      {t("unlink")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
