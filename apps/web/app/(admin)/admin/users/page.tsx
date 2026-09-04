import { AdminUsersGrid } from "@/components/admin/admin-users-grid";
import { PageHeader } from "@/components/layout/page-header";
import { coerceDateIso } from "@/lib/admin/constants";
import { ADMIN_LIST_CAP, adminListUsers } from "@/lib/admin/lists";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getTranslations } from "next-intl/server";

export default async function AdminUsersPage() {
  const admin = await requirePlatformAdmin();
  const [t, tTable] = await Promise.all([
    getTranslations("Admin.users"),
    getTranslations("Admin.table"),
  ]);
  const rows = await adminListUsers();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <PageHeader description={t("subtitle")} title={t("title")} />
      {rows.length >= ADMIN_LIST_CAP ? (
        <p className="text-sm text-muted-foreground">
          {tTable("truncated", { cap: String(ADMIN_LIST_CAP) })}
        </p>
      ) : null}
      <AdminUsersGrid
        currentUserId={admin.userId}
        items={rows.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          emailVerified: r.emailVerified,
          platformRole: r.platformRole,
          defaultWorkspaceId: r.defaultWorkspaceId,
          referralCode: r.referralCode,
          referredByEmail: r.referredByEmail,
          membershipCount: r.membershipCount,
          createdAtIso: coerceDateIso(r.createdAt) ?? "",
          lastSeenAtIso: coerceDateIso(r.lastSeenAt),
        }))}
      />
    </div>
  );
}
