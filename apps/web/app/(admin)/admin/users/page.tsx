import { AdminUsersGrid } from "@/components/admin/admin-users-grid";
import { adminListUsers } from "@/lib/admin/lists";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getTranslations } from "next-intl/server";

export default async function AdminUsersPage() {
  const admin = await requirePlatformAdmin();
  const t = await getTranslations("Admin.users");
  const rows = await adminListUsers();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
      </div>
      <AdminUsersGrid
        currentUserId={admin.userId}
        items={rows.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          emailVerified: r.emailVerified,
          platformRole: r.platformRole,
          defaultWorkspaceId: r.defaultWorkspaceId,
          membershipCount: r.membershipCount,
          createdAtIso: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
