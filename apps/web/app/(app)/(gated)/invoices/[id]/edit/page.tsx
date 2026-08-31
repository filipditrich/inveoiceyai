import { InvoiceBuilderForm } from "@/components/invoices/invoice-builder-form";
import { ProductToastTracker } from "@/features/c15t/product-toast-tracker";
import { PageHeader } from "@/components/layout/page-header";
import { loadLastInvoiceSuggestions } from "@/lib/load-last-invoice-suggestions";
import { loadClientOptions, loadIssuerOptions } from "@/lib/load-parties";
import { requireWorkspace } from "@/lib/auth/session";
import { requireEntitlements } from "@/lib/entitlements/entitlements";
import {
  loadWorkspaceDefaultLook,
  loadWorkspaceLookDocuments,
} from "@/lib/load-workspace-look";
import { InvoiceSchema } from "@invoicey/invoice-core/schema";
import {
  ACCENT_COLOR_HEX,
  findLookDocument,
  type LegacyAccentColor,
} from "@invoicey/invoice-core/looks";
import { invoices } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { FilePenLineIcon } from "lucide-react";

type Params = Promise<{ id: string }>;
type Search = Promise<{
  invalid?: string;
  toast?: string;
  recoveryAttempt?: string;
}>;

export default async function InvoiceEditPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const t = await getTranslations("Invoices.builder");
  const { workspaceId } = await requireWorkspace();
  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.workspaceId, workspaceId)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    notFound();
  }
  if (row.issuedAt) {
    redirect(`/invoices/${id}`);
  }

  const payload = InvoiceSchema.safeParse(row.payloadJson);
  if (!payload.success) {
    notFound();
  }

  const [issuers, clients, lastInvoice, plan, defaultLook, workspaceLooks] =
    await Promise.all([
      loadIssuerOptions(workspaceId),
      loadClientOptions(workspaceId),
      loadLastInvoiceSuggestions(workspaceId, {
        issuerId: row.issuerId,
        clientId: row.clientId,
        excludeId: id,
      }),
      requireEntitlements(),
      loadWorkspaceDefaultLook(workspaceId),
      loadWorkspaceLookDocuments(workspaceId),
    ]);

  const inv = payload.data;
  const look = inv.look ?? defaultLook;
  const lookTheme = findLookDocument(
    look.id,
    look.version,
    workspaceLooks,
  )?.theme;
  const appearance = inv.appearance;
  const accentEntry = appearance?.accent
    ? (Object.entries(ACCENT_COLOR_HEX) as [LegacyAccentColor, string][]).find(
        ([, hex]) => hex.toLowerCase() === appearance.accent!.toLowerCase(),
      )
    : undefined;

  return (
    <div className="space-y-6">
      <ProductToastTracker
        clearNewInvoiceRecoveryWorkspaceId={workspaceId}
        properties={{
          creationEntry: "structured",
          documentType: inv.meta.docType,
          currency: inv.meta.currency,
        }}
        successInvoiceId={id}
        toast={sp.toast ?? null}
      />
      <PageHeader
        description={t("subtitle")}
        icon={<FilePenLineIcon />}
        title={t("editTitle")}
      />
      <InvoiceBuilderForm
        clients={clients}
        defaultLook={defaultLook}
        invalidQuery={sp.invalid ?? null}
        invoiceId={id}
        issuers={issuers}
        lastInvoice={lastInvoice}
        looksApply={plan.entitlements.looks.apply}
        mode="edit"
        workspaceLooks={workspaceLooks}
        workspaceId={workspaceId}
        initial={{
          issuerId: row.issuerId,
          clientId: row.clientId,
          docType: inv.meta.docType,
          issueDate: inv.meta.issueDate,
          dueDate: inv.meta.dueDate,
          duzp: inv.meta.duzp,
          currency: inv.meta.currency,
          language: inv.meta.language,
          vatMode: inv.vat.mode,
          suppliesAbroad: inv.vat.suppliesAbroad,
          legalNote: inv.vat.legalNote,
          localReverseChargeCode: inv.vat.localReverseChargeCode,
          correctedInvoiceNumber: inv.meta.correctedInvoiceNumber,
          notes: inv.notes,
          items: inv.items.map((it) => ({
            description: it.description,
            quantity: it.quantity,
            unit: it.unit,
            unitPriceWithoutVat: it.unitPriceWithoutVat,
            vatRate: it.vatRate,
          })),
          lookId: look.id,
          lookVersion: look.version,
          accentKey: accentEntry?.[0] ?? "default",
          showStamp: appearance?.showStamp ?? lookTheme?.showStamp ?? true,
          showSignature:
            appearance?.showSignature ?? lookTheme?.showSignature ?? true,
          showQr: appearance?.showQr ?? lookTheme?.showQr ?? true,
          showNotesBlock: appearance?.showNotes ?? lookTheme?.showNotes ?? true,
        }}
      />
    </div>
  );
}
