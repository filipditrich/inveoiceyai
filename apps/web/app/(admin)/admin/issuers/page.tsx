import { AdminIssuersGrid } from "@/components/admin/admin-issuers-grid";
import { PageHeader } from "@/components/layout/page-header";
import { ADMIN_LIST_CAP, adminListIssuers } from "@/lib/admin/lists";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getTranslations } from "next-intl/server";

export default async function AdminIssuersPage() {
  await requirePlatformAdmin();
  const [t, tTable] = await Promise.all([
    getTranslations("Admin.issuers"),
    getTranslations("Admin.table"),
  ]);
  const rows = await adminListIssuers();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <PageHeader description={t("subtitle")} title={t("title")} />
      {rows.length >= ADMIN_LIST_CAP ? (
        <p className="text-sm text-muted-foreground">
          {tTable("truncated", { cap: String(ADMIN_LIST_CAP) })}
        </p>
      ) : null}
      <AdminIssuersGrid
        items={rows.map((r) => ({
          id: r.id,
          name: r.name,
          ico: r.ico,
          dic: r.dic,
          workspaceId: r.workspaceId,
          workspaceName: r.workspaceName,
          source: r.source,
          updatedAtIso: r.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
