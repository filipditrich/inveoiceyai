import { InvoiceImportForm } from "@/components/invoices/invoice-import-form";
import { PageHeader } from "@/components/layout/page-header";
import { SectionPager } from "@/components/layout/section-pager";
import { requireWorkspace } from "@/lib/auth/session";
import { loadIssuerOptions } from "@/lib/load-parties";
import { originFromQuery } from "@/lib/migration-providers";
import { FileUpIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function InvoiceImportPage({
  searchParams,
}: {
  searchParams: Promise<{ origin?: string }>;
}) {
  const [t, tNav] = await Promise.all([
    getTranslations("Invoices.import"),
    getTranslations("App.nav"),
  ]);
  const { workspaceId } = await requireWorkspace();
  const issuers = await loadIssuerOptions(workspaceId);
  const sp = await searchParams;

  return (
    <div className="@container/main space-y-4">
      <PageHeader
        description={t("subtitle")}
        eyebrow={tNav("invoices")}
        icon={<FileUpIcon />}
        title={t("title")}
      />
      <InvoiceImportForm
        initialOrigin={originFromQuery(sp.origin)}
        issuers={issuers.map((i) => ({
          id: i.id,
          name: i.snapshot.name,
        }))}
      />
      <SectionPager group="invoices" />
    </div>
  );
}
