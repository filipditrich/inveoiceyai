"use client";

import { updateWorkspaceAction } from "@/actions/workspace";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorkspaceRole } from "@/lib/auth/workspace-types";
import { LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export function WorkspaceSettingsPanel({
  name,
  slug,
  role,
}: {
  name: string;
  slug: string;
  role: WorkspaceRole;
}) {
  const t = useTranslations("App.settings.workspace");
  const tErrors = useTranslations("App.workspaceErrors");
  const router = useRouter();
  const canEdit = role === "owner" || role === "admin";
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();

  const save = () => {
    if (!canEdit || pending) return;
    startTransition(async () => {
      const result = await updateWorkspaceAction(value);
      if (!result.ok) {
        toast.error(tErrors(result.errorCode));
        return;
      }
      toast.success(t("saved"));
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pageTitle")}</CardTitle>
        <CardDescription>{t("pageDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="workspace-settings-name">{t("nameLabel")}</Label>
          <Input
            id="workspace-settings-name"
            value={value}
            disabled={!canEdit || pending}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                save();
              }
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="workspace-settings-slug">{t("slugLabel")}</Label>
          <Input id="workspace-settings-slug" value={slug} disabled readOnly />
          <p className="text-muted-foreground text-xs">{t("slugHint")}</p>
        </div>
        {!canEdit ? (
          <p className="text-muted-foreground text-sm">{t("readOnly")}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={pending || !value.trim() || value.trim() === name}
              onClick={() => save()}
            >
              {pending ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : null}
              {pending ? t("saving") : t("save")}
            </Button>
            <Button variant="ghost" render={<Link href="/settings/members" />}>
              {t("membersLink")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
