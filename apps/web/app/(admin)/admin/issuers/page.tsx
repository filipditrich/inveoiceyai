import { AdminIssuersGrid } from "@/components/admin/admin-issuers-grid";
import { adminListIssuers } from "@/lib/admin/lists";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getTranslations } from "next-intl/server";

export default async function AdminIssuersPage() {
  await requirePlatformAdmin();
  const t = await getTranslations("Admin.issuers");
  const rows = await adminListIssuers();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>
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
