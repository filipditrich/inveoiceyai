import { AdminWorkspacesGrid } from "@/components/admin/admin-workspaces-grid";
import { PageHeader } from "@/components/layout/page-header";
import { ADMIN_LIST_CAP, adminListWorkspaces } from "@/lib/admin/lists";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getTranslations } from "next-intl/server";

export default async function AdminWorkspacesPage() {
  await requirePlatformAdmin();
  const [t, tTable] = await Promise.all([
    getTranslations("Admin.workspaces"),
    getTranslations("Admin.table"),
  ]);
  const rows = await adminListWorkspaces();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <PageHeader description={t("subtitle")} title={t("title")} />
      {rows.length >= ADMIN_LIST_CAP ? (
        <p className="text-sm text-muted-foreground">
          {tTable("truncated", { cap: String(ADMIN_LIST_CAP) })}
        </p>
      ) : null}
      <AdminWorkspacesGrid
        items={rows.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          memberCount: r.memberCount,
          invoiceCount: r.invoiceCount,
          issuerCount: r.issuerCount,
          planName: r.planName,
          tokensRemaining: r.tokensRemaining,
          aiBurn30d: r.aiBurn30d,
          frozen: Boolean(r.frozenAt),
          createdAtIso: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
