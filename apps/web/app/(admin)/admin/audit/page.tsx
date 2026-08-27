import { ScrollTextIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AdminAuditList } from "@/components/admin/admin-audit-list";
import { AdminSection } from "@/components/admin/admin-detail-kit";
import { PageHeader } from "@/components/layout/page-header";
import { adminListPlatformAuditEvents } from "@/lib/admin/detail";
import { requirePlatformAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Every cross-tenant write from this console. Admin actions reach data its
 * owners cannot see the admin touching, so the log is the only thing that makes
 * them reviewable afterwards.
 */
export default async function AdminAuditPage() {
  await requirePlatformAdmin();
  const t = await getTranslations("Admin.audit");
  const events = await adminListPlatformAuditEvents();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeader
        description={t("subtitle")}
        icon={<ScrollTextIcon />}
        title={t("title")}
      />
      <AdminSection
        title={t("recentTitle")}
        description={t("count", { count: events.length })}
      >
        <AdminAuditList events={events} showWorkspace />
      </AdminSection>
    </div>
  );
}
