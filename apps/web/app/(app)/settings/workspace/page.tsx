import { WorkspacePlanCard } from "@/components/settings/workspace-plan-card";
import { WorkspaceSettingsPanel } from "@/components/settings/workspace-settings-panel";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { requireEntitlements } from "@/lib/entitlements/entitlements";
import { requireWorkspace } from "@/lib/auth/session";
import { listUserWorkspaces } from "@/lib/auth/workspaces";
import { workspaces } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { eq } from "drizzle-orm";
import { loadLookCatalog } from "@/lib/load-workspace-look";
import { defaultLookRef } from "@invoicey/invoice-core/looks";
import { Building2Icon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

export default async function SettingsWorkspacePage() {
  const t = await getTranslations("App.settings.workspace");
  const ws = await requireWorkspace();
  const [workspacesList, plan, [workspaceRow], workspaceLooks] =
    await Promise.all([
      listUserWorkspaces(ws.userId),
      requireEntitlements(),
      db
        .select({
          defaultLookId: workspaces.defaultLookId,
          defaultLookVersion: workspaces.defaultLookVersion,
        })
        .from(workspaces)
        .where(eq(workspaces.id, ws.workspaceId))
        .limit(1),
      loadLookCatalog(ws.workspaceId),
    ]);
  const active = workspacesList.find((item) => item.id === ws.workspaceId);
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
        defaultLook={
          workspaceRow
            ? {
                id: workspaceRow.defaultLookId,
                version: workspaceRow.defaultLookVersion,
              }
            : defaultLookRef()
        }
        looksApply={plan.entitlements.looks.apply}
        logo={active.logo}
        name={active.name}
        role={active.role}
        slug={active.slug}
        uploadConfigured={Boolean(process.env.UPLOADTHING_TOKEN?.trim())}
        workspaceLooks={workspaceLooks}
      />
      <WorkspacePlanCard
        entitlements={plan.entitlements}
        planName={plan.planName}
      />
    </div>
  );
}
