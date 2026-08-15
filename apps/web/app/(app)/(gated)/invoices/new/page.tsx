import { InvoiceBuilderForm } from "@/components/invoices/invoice-builder-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/session";
import { loadLastInvoiceSuggestions } from "@/lib/load-last-invoice-suggestions";
import { loadClientOptions, loadIssuerOptions } from "@/lib/load-parties";
import { getTranslations } from "next-intl/server";
import {
  BookOpenIcon,
  ExternalLinkIcon,
  FileCheck2Icon,
  FilePenLineIcon,
  QrCodeIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

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
  const lastInvoice = await loadLastInvoiceSuggestions(workspaceId, {
    issuerId: issuers[0]?.id,
    clientId: clients[0]?.id,
  });

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <PageHeader
        actions={
          <>
            <Button
              render={<Link href="/docs/guides/creating-invoices" prefetch />}
              size="sm"
              variant="outline"
            >
              <BookOpenIcon />
              {t("builderGuide")}
            </Button>
            <Button
              render={<Link href="/docs/concepts/czech-vat" prefetch />}
              size="sm"
              variant="outline"
            >
              <BookOpenIcon />
              {t("vatGuide")}
            </Button>
            <Button
              render={
                <a
                  href="https://ares.gov.cz/ekonomicke-subjekty"
                  rel="noreferrer"
                  target="_blank"
                />
              }
              size="sm"
              variant="ghost"
            >
              {t("officialAres")}
              <ExternalLinkIcon />
            </Button>
          </>
        }
        description={t("subtitle")}
        icon={<FilePenLineIcon />}
        title={t("title")}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <PageExplanation
          description={t("draftExplanation")}
          icon={<FilePenLineIcon />}
          title={t("draftExplanationTitle")}
        />
        <PageExplanation
          description={t("issueExplanation")}
          icon={<FileCheck2Icon />}
          title={t("issueExplanationTitle")}
        />
        <PageExplanation
          description={t("outputsExplanation")}
          icon={<QrCodeIcon />}
          title={t("outputsExplanationTitle")}
        />
      </div>
      <InvoiceBuilderForm
        clients={clients}
        invalidQuery={sp.invalid ?? null}
        issuers={issuers}
        lastInvoice={lastInvoice}
        mode="create"
      />
    </div>
  );
}

function PageExplanation({
  description,
  icon,
  title,
}: {
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="bg-card flex items-start gap-3 rounded-lg border p-4">
      <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4">
        {icon}
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
