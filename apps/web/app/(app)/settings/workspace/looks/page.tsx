import { WorkspaceLooksList } from "@/components/looks/workspace-looks-list";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { requireWorkspace } from "@/lib/auth/session";
import { requireEntitlements } from "@/lib/entitlements/entitlements";
import { loadWorkspaceLookDocuments } from "@/lib/load-workspace-look";
import { Rows3Icon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { listPublishedCommunityLookRowsForPublisher } from "@invoicey/db";
import { db } from "@invoicey/db/client";

export default async function WorkspaceLooksPage() {
  const t = await getTranslations("App.settings.workspace.looks");
  const { workspaceId, role } = await requireWorkspace();
  const [plan, looks, communityRows] = await Promise.all([
    requireEntitlements(),
    loadWorkspaceLookDocuments(workspaceId),
    listPublishedCommunityLookRowsForPublisher(db, workspaceId),
  ]);
  const canEdit = role === "owner" || role === "admin";
  const entitled = plan.entitlements.looks.apply === "catalog";
  const publishedLookIds = [...new Set(communityRows.map((row) => row.lookId))];

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        description={t("pageDescription")}
        icon={<Rows3Icon />}
        title={t("pageTitle")}
      />
      <p className="text-sm text-muted-foreground">
        <Link
          className="underline-offset-4 hover:underline"
          href="/settings/workspace"
        >
          {t("defaultLookLink")}
        </Link>
      </p>
      <WorkspaceLooksList
        canEdit={canEdit}
        entitled={entitled}
        looks={looks}
        publishedLookIds={publishedLookIds}
      />
    </div>
  );
}
