import { InvoiceImportForm } from "@/components/invoices/invoice-import-form";
import { PageHeader } from "@/components/layout/page-header";
import { SectionPager } from "@/components/layout/section-pager";
import { requireWorkspace } from "@/lib/auth/session";
import { loadIssuerOptions } from "@/lib/load-parties";
import { FileUpIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function InvoiceImportPage() {
  const [t, tNav] = await Promise.all([
    getTranslations("Invoices.import"),
    getTranslations("App.nav"),
  ]);
  const { workspaceId } = await requireWorkspace();
  const issuers = await loadIssuerOptions(workspaceId);

  return (
    <div className="@container/main space-y-4">
      <PageHeader
        description={t("subtitle")}
        eyebrow={tNav("invoices")}
        icon={<FileUpIcon />}
        title={t("title")}
      />
      <InvoiceImportForm
        issuers={issuers.map((i) => ({
          id: i.id,
          name: i.snapshot.name,
        }))}
      />
      <SectionPager group="invoices" />
    </div>
  );
}
