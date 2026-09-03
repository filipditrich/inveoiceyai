import { unpublishCommunityLookAction } from "@/actions/admin-control";
import {
  AdminEmpty,
  AdminMiniTable,
  AdminSection,
} from "@/components/admin/admin-detail-kit";
import { PageHeader } from "@/components/layout/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { adminListLiveCommunityLooks } from "@/lib/admin/workspace-control";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { PaletteIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";

import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLooksPage() {
  await requirePlatformAdmin();
  const [t, format] = await Promise.all([
    getTranslations("Admin.looks"),
    getFormatter(),
  ]);
  const rows = await adminListLiveCommunityLooks();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        description={t("subtitle")}
        icon={<PaletteIcon />}
        title={t("title")}
      />
      <AdminSection title={t("liveTitle")} description={t("liveDescription")}>
        {rows.length === 0 ? (
          <AdminEmpty>{t("empty")}</AdminEmpty>
        ) : (
          <AdminMiniTable
            headers={[
              t("columns.look"),
              t("columns.version"),
              t("columns.workspace"),
              t("columns.published"),
              "",
            ]}
            rows={rows.map((row) => [
              <span key="id" className="font-mono text-xs">
                {row.lookId}
              </span>,
              row.version,
              <Link
                key="ws"
                className="hover:underline"
                href={`/admin/workspaces/${row.publisherWorkspaceId}`}
              >
                {row.publisherWorkspaceName}
              </Link>,
              <span key="at" className="whitespace-nowrap tabular-nums">
                {format.dateTime(row.createdAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>,
              <form key="unpublish" action={unpublishCommunityLookAction}>
                <input
                  name="workspaceId"
                  type="hidden"
                  value={row.publisherWorkspaceId}
                />
                <input name="lookId" type="hidden" value={row.lookId} />
                <input name="returnTo" type="hidden" value="/admin/looks" />
                <SubmitButton size="sm" variant="ghost">
                  {t("unpublish")}
                </SubmitButton>
              </form>,
            ])}
          />
        )}
      </AdminSection>
    </div>
  );
}
