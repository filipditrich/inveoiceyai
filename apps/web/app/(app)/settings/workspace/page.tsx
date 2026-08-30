import { WorkspacePlanCard } from "@/components/settings/workspace-plan-card";
import { WorkspaceSettingsPanel } from "@/components/settings/workspace-settings-panel";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { requireEntitlements } from "@/lib/entitlements/entitlements";
import { requireWorkspace } from "@/lib/auth/session";
import { listUserWorkspaces } from "@/lib/auth/workspaces";
import { Building2Icon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

export default async function SettingsWorkspacePage() {
  const t = await getTranslations("App.settings.workspace");
  const ws = await requireWorkspace();
  const [workspaces, plan] = await Promise.all([
    listUserWorkspaces(ws.userId),
    requireEntitlements(),
  ]);
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
      <WorkspacePlanCard
        entitlements={plan.entitlements}
        planName={plan.planName}
      />
    </div>
  );
}
