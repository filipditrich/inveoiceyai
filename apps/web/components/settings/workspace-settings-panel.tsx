"use client";

import {
  updateWorkspaceAction,
  updateWorkspaceLookAction,
} from "@/actions/workspace";
import { LookPicker } from "@/components/invoices/look-picker";
import { WorkspaceLogoField } from "@/components/settings/workspace-logo-field";
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
import {
  looksForPicker,
  type LookDocument,
  type LookRef,
} from "@invoicey/invoice-core/looks";
import { LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

export function WorkspaceSettingsPanel({
  name,
  slug,
  logo,
  role,
  uploadConfigured,
  looksApply,
  defaultLook,
  workspaceLooks = [],
}: {
  name: string;
  slug: string;
  logo: string | null;
  role: WorkspaceRole;
  uploadConfigured: boolean;
  looksApply: "classic" | "catalog";
  defaultLook: LookRef;
  workspaceLooks?: readonly LookDocument[];
}) {
  const t = useTranslations("App.settings.workspace");
  const tErrors = useTranslations("App.workspaceErrors");
  const router = useRouter();
  const canEdit = role === "owner" || role === "admin";
  const [value, setValue] = useState(name);
  const [logoUrl, setLogoUrl] = useState(logo ?? "");
  const [look, setLook] = useState<LookRef>(defaultLook);
  const [pending, startTransition] = useTransition();

  const persist = (input: { name?: string; logo?: string | null }) => {
    if (!canEdit || pending) return;
    startTransition(async () => {
      const result = await updateWorkspaceAction(input);
      if (!result.ok) {
        toast.error(tErrors(result.errorCode));
        return;
      }
      if (input.logo !== undefined) {
        setLogoUrl(input.logo ?? "");
        toast.success(t("logoSaved"));
      } else {
        toast.success(t("saved"));
      }
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
        <WorkspaceLogoField
          canEdit={canEdit}
          onUrl={(next) => persist({ logo: next })}
          pending={pending}
          uploadConfigured={uploadConfigured}
          url={logoUrl}
        />
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
                persist({ name: value });
              }
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="workspace-settings-slug">{t("slugLabel")}</Label>
          <Input id="workspace-settings-slug" value={slug} disabled readOnly />
          <p className="text-muted-foreground text-xs">{t("slugHint")}</p>
        </div>
        <div className="space-y-2">
          <Label>{t("lookLabel")}</Label>
          <p className="text-muted-foreground text-xs">{t("lookHint")}</p>
          <LookPicker
            allowLockedPreview={false}
            disabled={!canEdit || pending}
            looks={looksForPicker(workspaceLooks, look).map((item) => ({
              id: item.id,
              version: item.version,
              name: item.name,
              origin: item.origin,
              layout: item.layout,
              accent: item.theme.accent,
              paper: item.theme.paper,
            }))}
            looksApply={looksApply}
            manageHref="/settings/workspace/looks"
            onChange={(next) => {
              if (!canEdit || pending) return;
              const previous = look;
              setLook(next);
              startTransition(async () => {
                const result = await updateWorkspaceLookAction({
                  lookId: next.id,
                  lookVersion: next.version,
                });
                if (!result.ok) {
                  setLook(previous);
                  toast.error(tErrors(result.errorCode));
                  return;
                }
                toast.success(t("lookSaved"));
                router.refresh();
              });
            }}
            value={look}
          />
        </div>
        {!canEdit ? (
          <p className="text-muted-foreground text-sm">{t("readOnly")}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={pending || !value.trim() || value.trim() === name}
              onClick={() => persist({ name: value })}
            >
              {pending ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : null}
              {pending ? t("saving") : t("save")}
            </Button>
            <Button
              variant="ghost"
              render={<Link href="/settings/workspace/looks" />}
            >
              {t("looksLink")}
            </Button>
            <Button
              variant="ghost"
              render={<Link href="/settings/workspace/members" />}
            >
              {t("membersLink")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
