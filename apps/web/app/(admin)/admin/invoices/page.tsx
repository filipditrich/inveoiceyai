import { AdminInvoicesGrid } from "@/components/admin/admin-invoices-grid";
import { PageHeader } from "@/components/layout/page-header";
import { adminListInvoices } from "@/lib/admin/lists";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getTranslations } from "next-intl/server";

export default async function AdminInvoicesPage() {
  await requirePlatformAdmin();
  const t = await getTranslations("Admin.invoices");
  const rows = await adminListInvoices();

  return (
    <div className="flex flex-1 flex-col gap-4">
      <PageHeader description={t("subtitle")} title={t("title")} />
      <AdminInvoicesGrid
        items={rows.map((r) => ({
          id: r.id,
          number: r.number,
          clientName: r.clientName,
          workspaceId: r.workspaceId,
          workspaceName: r.workspaceName,
          issuerId: r.issuerId,
          issuerName: r.issuerName,
          total: r.total,
          currency: r.currency,
          issueDate: r.issueDate,
          dueDate: r.dueDate,
          displayStatus: r.displayStatus,
        }))}
      />
    </div>
  );
}
