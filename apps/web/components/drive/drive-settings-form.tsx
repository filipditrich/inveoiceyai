"use client";

import { useMemo, useState, useTransition } from "react";
import {
  revokeDriveDeviceAction,
  saveDriveSettingsAction,
} from "@/actions/drive-settings";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatDateTime } from "@/lib/format";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import type { DriveDeviceRow } from "@invoicey/db";
import {
  applyDriveLayout,
  parseDriveLayoutTemplate,
} from "@invoicey/invoice-core/drive-layout";

import type { AppLocale } from "@/i18n/config";

const PRESETS = [
  { key: "yearFolder", template: "{year}/{kind}_{number}" },
  { key: "flatYear", template: "{year}_{name}" },
  { key: "nameOnly", template: "{name}" },
] as const;

interface DriveSettingsFormProps {
  devices: DriveDeviceRow[];
  dmgUrl: string | null;
  hiddenWorkspaceIds: string[];
  includeIsdoc: boolean;
  layoutTemplate: string;
  sampleIssuer: string;
  sampleWorkspace: string;
  workspaces: { id: string; name: string }[];
}

export function DriveSettingsForm({
  devices,
  dmgUrl,
  hiddenWorkspaceIds,
  includeIsdoc,
  layoutTemplate,
  sampleIssuer,
  sampleWorkspace,
  workspaces,
}: DriveSettingsFormProps) {
  const t = useTranslations("Settings.drive");
  const locale = useLocale() as AppLocale;
  const [pending, startTransition] = useTransition();
  const [template, setTemplate] = useState(layoutTemplate);
  const [isdoc, setIsdoc] = useState(includeIsdoc);
  const [hidden, setHidden] = useState<string[]>(hiddenWorkspaceIds);

  const parsed = parseDriveLayoutTemplate(template);
  const preview = useMemo(() => {
    if (!parsed.ok) {
      return null;
    }
    const layout = applyDriveLayout({
      template: parsed.template,
      issueDate: "2026-03-15",
      number: "2026001",
      language: locale,
      docType: "invoice",
    });
    return `${sampleWorkspace} / ${sampleIssuer} / ${layout.pdf}`;
  }, [locale, parsed, sampleIssuer, sampleWorkspace]);

  const save = () => {
    startTransition(async () => {
      const result = await saveDriveSettingsAction({
        layoutTemplate: template,
        includeIsdoc: isdoc,
        hiddenWorkspaceIds: hidden,
      });
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
        return;
      }
      toast.success(t("saved"));
    });
  };

  const toggleWorkspace = (id: string, visible: boolean) => {
    setHidden((current) =>
      visible ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const allHidden = workspaces.length > 0 && hidden.length >= workspaces.length;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("downloadTitle")}</CardTitle>
          <CardDescription>{t("downloadDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {dmgUrl ? (
            <Button render={<a href={dmgUrl} />}>{t("downloadButton")}</Button>
          ) : (
            <p className="text-sm text-muted-foreground">{t("downloadSoon")}</p>
          )}
          <p className="text-sm text-muted-foreground">{t("connectHint")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("layoutTitle")}</CardTitle>
          <CardDescription>{t("layoutDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="drive-layout">{t("templateLabel")}</Label>
            <Input
              id="drive-layout"
              value={template}
              aria-describedby="drive-layout-preview"
              onChange={(event) => setTemplate(event.target.value)}
            />
            <p
              className="font-mono text-xs leading-relaxed text-muted-foreground"
              id="drive-layout-preview"
            >
              {preview ?? t("previewInvalid")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset.key}
                size="sm"
                type="button"
                variant="outline"
                onClick={() => setTemplate(preset.template)}
              >
                {t(`presets.${preset.key}`)}
              </Button>
            ))}
          </div>
          <label className="flex items-center gap-2.5 text-sm">
            <Switch
              checked={isdoc}
              onCheckedChange={setIsdoc}
              aria-label={t("includeIsdoc")}
            />
            {t("includeIsdoc")}
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("workspacesTitle")}</CardTitle>
          <CardDescription>{t("workspacesDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("workspacesEmpty")}
            </p>
          ) : (
            workspaces.map((workspace) => {
              const visible = !hidden.includes(workspace.id);
              return (
                <label
                  key={workspace.id}
                  className="flex items-center gap-2.5 text-sm"
                >
                  <Checkbox
                    checked={visible}
                    onCheckedChange={(next) =>
                      toggleWorkspace(workspace.id, next === true)
                    }
                  />
                  {workspace.name}
                </label>
              );
            })
          )}
          {allHidden ? (
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {t("workspacesAllHidden")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("devicesTitle")}</CardTitle>
          <CardDescription>{t("devicesDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("devicesEmpty")}</p>
          ) : (
            devices.map((device) => (
              <div
                key={device.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{device.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {device.revokedAt
                      ? t("revoked")
                      : t("lastSeen", {
                          when: formatDateTime(device.lastSeenAt, locale),
                        })}
                    {` · ${device.tokenFingerprint}`}
                  </p>
                </div>
                {device.revokedAt ? null : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      startTransition(async () => {
                        const result = await revokeDriveDeviceAction(device.id);
                        if (!result.ok) {
                          toast.error(t("revokeFailed"));
                          return;
                        }
                        toast.success(t("revokeSuccess"));
                      });
                    }}
                  >
                    {t("revoke")}
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div>
        <Button
          disabled={pending || !parsed.ok}
          loading={pending}
          onClick={save}
        >
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
