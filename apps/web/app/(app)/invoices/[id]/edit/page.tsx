import { InvoiceBuilderForm } from "@/components/invoices/invoice-builder-form";
import { loadClientOptions, loadIssuerOptions } from "@/lib/load-parties";
import { requireWorkspace } from "@/lib/auth/session";
import { InvoiceSchema } from "@invoicey/invoice-core/schema";
import { invoices } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

type Params = Promise<{ id: string }>;
type Search = Promise<{ invalid?: string }>;

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

  const [issuers, clients] = await Promise.all([
    loadIssuerOptions(workspaceId),
    loadClientOptions(workspaceId),
  ]);

  const inv = payload.data;

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("editTitle")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <InvoiceBuilderForm
        clients={clients}
        invalidQuery={sp.invalid ?? null}
        invoiceId={id}
        issuers={issuers}
        mode="edit"
        initial={{
          issuerId: row.issuerId,
          clientId: row.clientId,
          docType: inv.meta.docType,
          issueDate: inv.meta.issueDate,
          dueDate: inv.meta.dueDate,
          duzp: inv.meta.duzp,
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
        }}
      />
    </div>
  );
}
