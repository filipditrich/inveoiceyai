import type { ReactNode } from "react";
import { InvoiceBuilderForm } from "@/components/invoices/invoice-builder-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/session";
import { requireEntitlements } from "@/lib/entitlements/entitlements";
import { loadLastInvoiceSuggestions } from "@/lib/load-last-invoice-suggestions";
import { loadClientOptions, loadIssuerOptions } from "@/lib/load-parties";
import {
  loadLookCatalog,
  loadWorkspaceDefaultLook,
} from "@/lib/load-workspace-look";
import {
  BookOpenIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  FileCheck2Icon,
  FilePenLineIcon,
  QrCodeIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

type Search = Promise<{ invalid?: string }>;

export default async function InvoiceNewPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { workspaceId } = await requireWorkspace();
  const sp = await searchParams;
  const t = await getTranslations("Invoices.builder");
  const [issuers, clients, plan, defaultLook, workspaceLooks] =
    await Promise.all([
      loadIssuerOptions(workspaceId),
      loadClientOptions(workspaceId),
      requireEntitlements(),
      loadWorkspaceDefaultLook(workspaceId),
      loadLookCatalog(workspaceId),
    ]);
  const lastInvoice = await loadLastInvoiceSuggestions(workspaceId, {
    issuerId: issuers[0]?.id,
    clientId: clients[0]?.id,
  });

  const explanations = (
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
  );

  return (
    <div className="space-y-6">
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

      {/* Three stacked cards push the first field two screens down a phone,
          so the primer folds away there and stays open on a wide screen. */}
      <details className="group rounded-lg border bg-card md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium">
          {t("explanationsSummary")}
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t p-3">{explanations}</div>
      </details>
      <div className="hidden md:block">{explanations}</div>
      <InvoiceBuilderForm
        clients={clients}
        defaultLook={defaultLook}
        invalidQuery={sp.invalid ?? null}
        issuers={issuers}
        lastInvoice={lastInvoice}
        looksApply={plan.entitlements.looks.apply}
        mode="create"
        workspaceLooks={workspaceLooks}
        workspaceId={workspaceId}
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
    <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4">
        {icon}
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
