import { InvoiceImportForm } from "@/components/invoices/invoice-import-form";
import { PageHeader } from "@/components/layout/page-header";
import { requireWorkspace } from "@/lib/auth/session";
import { loadIssuerOptions } from "@/lib/load-parties";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FileUpIcon } from "lucide-react";

export default async function InvoiceImportPage() {
  const t = await getTranslations("Invoices.import");
  const { workspaceId } = await requireWorkspace();
  const issuers = await loadIssuerOptions(workspaceId);

  return (
    <div className="@container/main space-y-4 px-4 py-6 lg:px-6">
      <PageHeader
        description={t("subtitle")}
        eyebrow={
          <span>
            <Link className="hover:underline" href="/invoices">
              {t("backLink")}
            </Link>
          </span>
        }
        icon={<FileUpIcon />}
        title={t("title")}
      />
      <InvoiceImportForm
        issuers={issuers.map((i) => ({
          id: i.id,
          name: i.snapshot.name,
        }))}
      />
    </div>
  );
}
