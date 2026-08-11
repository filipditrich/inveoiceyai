import { AdminWorkspacesGrid } from "@/components/admin/admin-workspaces-grid";
import { adminListWorkspaces } from "@/lib/admin/lists";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getTranslations } from "next-intl/server";

export default async function AdminWorkspacesPage() {
  await requirePlatformAdmin();
  const t = await getTranslations("Admin.workspaces");
  const rows = await adminListWorkspaces();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>
      <AdminWorkspacesGrid
        items={rows.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          memberCount: r.memberCount,
          invoiceCount: r.invoiceCount,
          issuerCount: r.issuerCount,
          createdAtIso: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
