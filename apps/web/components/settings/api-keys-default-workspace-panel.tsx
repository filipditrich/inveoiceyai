"use client";

import { useTransition } from "react";
import { setDefaultWorkspaceAction } from "@/actions/workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { WorkspaceListItem } from "@/lib/auth/workspace-types";

export function ApiKeysDefaultWorkspacePanel({
  workspaces,
  defaultWorkspaceId,
  activeWorkspaceId,
}: {
  workspaces: WorkspaceListItem[];
  defaultWorkspaceId: string | null;
  activeWorkspaceId: string;
}) {
  const t = useTranslations("App.settings.apiKeysDefault");
  const tErrors = useTranslations("App.workspaceErrors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const current =
    workspaces.find((w) => w.id === defaultWorkspaceId) ?? workspaces[0];
  const active = workspaces.find((w) => w.id === activeWorkspaceId);
  const defaultDiverges =
    Boolean(defaultWorkspaceId) && defaultWorkspaceId !== activeWorkspaceId;

  const setDefault = (organizationId: string) => {
    if (pending) return;
    startTransition(async () => {
      const result = await setDefaultWorkspaceAction(organizationId);
      if (!result.ok) {
        toast.error(tErrors(result.errorCode));
        return;
      }
      toast.success(t("updated"));
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {current ? (
          <p className="text-sm">
            <span className="text-muted-foreground">{t("current")}: </span>
            <span className="font-medium">{current.name}</span>
          </p>
        ) : null}
        {defaultDiverges && active ? (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm leading-snug text-muted-foreground">
            {t("activeDiffers", { name: active.name })}
          </p>
        ) : null}
        <ul className="space-y-2">
          {workspaces.map((workspace) => {
            const isDefault = workspace.id === defaultWorkspaceId;
            const isActive = workspace.id === activeWorkspaceId;
            return (
              <li
                key={workspace.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {workspace.name}
                    {isActive ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({t("browserActive")})
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {workspace.slug}
                  </p>
                </div>
                {isDefault ? (
                  <Badge variant="secondary" className="gap-1">
                    <CheckIcon className="size-3" />
                    {t("alreadyDefault")}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setDefault(workspace.id)}
                  >
                    {pending ? (
                      <LoaderCircleIcon className="size-4 animate-spin" />
                    ) : null}
                    {t("setDefault")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
