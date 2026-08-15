import { WorkspaceSettingsPanel } from "@/components/settings/workspace-settings-panel";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { requireWorkspace } from "@/lib/auth/session";
import { listUserWorkspaces } from "@/lib/auth/workspaces";
import { Building2Icon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

export default async function SettingsWorkspacePage() {
  const t = await getTranslations("App.settings.workspace");
  const ws = await requireWorkspace();
  const workspaces = await listUserWorkspaces(ws.userId);
  const active = workspaces.find((item) => item.id === ws.workspaceId);
  if (!active) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        description={t("pageDescription")}
        icon={<Building2Icon />}
        title={t("pageTitle")}
      />
      <WorkspaceSettingsPanel
        logo={active.logo}
        name={active.name}
        role={active.role}
        slug={active.slug}
        uploadConfigured={Boolean(process.env.UPLOADTHING_TOKEN?.trim())}
      />
    </div>
  );
}
