import { LookDocumentEditor } from "@/components/looks/look-document-editor";
import { SettingsPageHeader } from "@/components/settings/settings-page-header";
import { requireWorkspace } from "@/lib/auth/session";
import { requireEntitlements } from "@/lib/entitlements/entitlements";
import { loadWorkspaceLookDocuments } from "@/lib/load-workspace-look";
import { Rows3Icon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { listCommunityLookRowsForPublisher } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { latestLooksById } from "@invoicey/invoice-core/looks";

type Params = Promise<{ lookId: string }>;

export default async function WorkspaceLookEditorPage({
  params,
}: {
  params: Params;
}) {
  const { lookId } = await params;
  const t = await getTranslations("App.settings.workspace.looks");
  const { workspaceId, role } = await requireWorkspace();
  if (role !== "owner" && role !== "admin") {
    redirect("/settings/workspace/looks");
  }
  const plan = await requireEntitlements();
  if (plan.entitlements.looks.apply !== "catalog") {
    redirect("/settings/workspace/looks");
  }
  const looks = await loadWorkspaceLookDocuments(workspaceId);
  const current = latestLooksById(looks).find((look) => look.id === lookId);
  if (!current) notFound();
  const communityRows = await listCommunityLookRowsForPublisher(
    db,
    workspaceId,
    lookId,
  );
  const published = communityRows.some(
    (row) => row.unpublishedAt === null && row.version === current.version,
  );

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        description={t("editorDescription", { id: current.id })}
        icon={<Rows3Icon />}
        title={current.name}
      />
      <p className="text-sm text-muted-foreground">
        <Link
          className="underline-offset-4 hover:underline"
          href="/settings/workspace/looks"
        >
          {t("backToList")}
        </Link>
      </p>
      <LookDocumentEditor initial={current} published={published} />
    </div>
  );
}
