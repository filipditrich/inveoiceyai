"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link2Icon, UnlinkIcon } from "lucide-react";

import {
  rebindSlackIdentityAction,
  unlinkSlackIdentityAction,
} from "@/actions/slack-link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
          <Link2Icon className="text-muted-foreground size-4" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        {identities.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <ul className="space-y-3">
            {identities.map((row) => {
              const sameWorkspace = row.workspaceId === currentWorkspaceId;
              return (
                <li
                  key={keyOf(row)}
                  className="flex flex-col gap-3 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1 text-sm">
                    <p className="font-medium">
                      {t("slackUser", { id: row.slackUserId })}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t("team", { id: row.slackTeamId })} · {row.workspaceName}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending || sameWorkspace}
                      loading={busyKey === `rebind:${keyOf(row)}`}
                      onClick={() => rebind(row)}
                    >
                      {sameWorkspace
                        ? t("currentWorkspace")
                        : t("useCurrentWorkspace", {
                            name: currentWorkspaceName,
                          })}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
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
