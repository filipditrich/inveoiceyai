import { DriveSettingsForm } from "@/components/drive/drive-settings-form";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { requireSession } from "@/lib/auth/session";
import { HardDriveIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  getDriveUserSettings,
  listDriveDevicesForUser,
  listMemberWorkspaces,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

export default async function SettingsDrivePage() {
  const t = await getTranslations("Settings.drive");
  const session = await requireSession();
  const [settings, devices, workspaces] = await Promise.all([
    getDriveUserSettings(db, session.id),
    listDriveDevicesForUser(db, session.id),
    listMemberWorkspaces(db, session.id),
  ]);
  const sampleWorkspace = workspaces[0]?.name ?? t("sampleWorkspace");
  const sampleIssuer = t("sampleIssuer");

  return (
    <div className="flex flex-col gap-6">
      <SettingsPageHeader
        description={t("pageDescription")}
        icon={<HardDriveIcon />}
        title={t("pageTitle")}
      />
      <DriveSettingsForm
        devices={devices}
        dmgUrl={env.INVOICEY_DRIVE_DMG_URL ?? null}
        hiddenWorkspaceIds={settings.hiddenWorkspaceIds}
        includeIsdoc={settings.includeIsdoc}
        layoutTemplate={settings.layoutTemplate}
        sampleIssuer={sampleIssuer}
        sampleWorkspace={sampleWorkspace}
        workspaces={workspaces}
      />
    </div>
  );
}
