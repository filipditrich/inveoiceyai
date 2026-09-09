import { PageHeader } from "@/components/layout/page-header";
import { InvoiceCollectionWaiting } from "@/components/payments/invoice-collection-waiting";
import { requireWorkspace } from "@/lib/auth/session";
import { assertCan } from "@/lib/authz/can";
import { loadInvoiceCollection } from "@/lib/payments/invoice-collection-repository";
import { ScanLineIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { renderSpaydQrSvg } from "@invoicey/invoice-core/spayd";

type Params = Promise<{ id: string }>;

export default async function CollectInvoicePage({
  params,
}: {
  params: Params;
}) {
  const [{ id }, { workspaceId }, t, tNav] = await Promise.all([
    params,
    requireWorkspace(),
    getTranslations("Invoices.collect"),
    getTranslations("App.nav"),
    assertCan("payments:manage"),
  ]);
  const collection = await loadInvoiceCollection(workspaceId, id);
  if (!collection) notFound();
  if (collection.settled) redirect(`/invoices/${id}`);
  const qrSvg = await renderSpaydQrSvg(collection.qrPayload);

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: `/invoices/${id}`, label: t("back") }}
        description={t("description")}
        eyebrow={tNav("invoices")}
        icon={<ScanLineIcon />}
        title={t("title")}
      />
      <InvoiceCollectionWaiting
        accountNumber={collection.accountNumber}
        clientName={collection.clientName}
        currency={collection.currency}
        iban={collection.iban}
        initialStatus={{
          paymentState: collection.paymentState,
          paidAmount: collection.paidAmount,
          outstandingAmount: collection.outstandingAmount,
          settled: collection.settled,
          polled: false,
          retryAfterMs: 0,
        }}
        invoiceId={collection.invoiceId}
        number={collection.number}
        qrSvg={qrSvg}
        requestedAmount={collection.outstandingAmount}
        variableSymbol={collection.variableSymbol}
      />
    </div>
  );
}
