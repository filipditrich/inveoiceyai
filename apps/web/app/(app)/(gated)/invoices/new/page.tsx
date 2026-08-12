import { InvoiceBuilderForm } from "@/components/invoices/invoice-builder-form";
import { requireWorkspace } from "@/lib/auth/session";
import { loadClientOptions, loadIssuerOptions } from "@/lib/load-parties";
import { getTranslations } from "next-intl/server";

type Search = Promise<{ invalid?: string }>;

export default async function InvoiceNewPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { workspaceId } = await requireWorkspace();
  const sp = await searchParams;
  const t = await getTranslations("Invoices.builder");
  const [issuers, clients] = await Promise.all([
    loadIssuerOptions(workspaceId),
    loadClientOptions(workspaceId),
  ]);

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <InvoiceBuilderForm
        clients={clients}
        invalidQuery={sp.invalid ?? null}
        issuers={issuers}
        mode="create"
      />
    </div>
  );
}
