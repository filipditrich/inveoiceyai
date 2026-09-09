import { PageHeader } from "@/components/layout/page-header";
import { PaymentRequestWaiting } from "@/components/payments/payment-request-waiting";
import { Button } from "@/components/ui/button";
import { env } from "@/env.config.server";
import { requireWorkspace } from "@/lib/auth/session";
import { assertCan } from "@/lib/authz/can";
import { loadPaymentRequestCollection } from "@/lib/payments/payment-request-collection";
import { ArrowLeftIcon, ScanLineIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { renderSpaydQrSvg } from "@invoicey/invoice-core/spayd";

type Params = Promise<{ id: string }>;

export default async function PaymentRequestPage({
  params,
}: {
  params: Params;
}) {
  const [{ id }, { workspaceId }, t] = await Promise.all([
    params,
    requireWorkspace(),
    getTranslations("PaymentRequests.wait"),
    assertCan("payments:manage"),
  ]);
  const collection = await loadPaymentRequestCollection(workspaceId, id);
  if (!collection) notFound();
  const qrSvg = await renderSpaydQrSvg(collection.qrPayload);
  const origin = env.NEXT_PUBLIC_APP_URL.replace(/\/$/u, "");

  return (
    <div className="space-y-6">
      <Button render={<Link href="/payments" prefetch />} variant="ghost">
        <ArrowLeftIcon data-icon="inline-start" />
        {t("back")}
      </Button>
      <PageHeader
        description={t("description")}
        eyebrow={t("eyebrow")}
        icon={<ScanLineIcon />}
        title={t("title")}
      />
      <PaymentRequestWaiting
        accountNumber={collection.accountNumber}
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
        publicUrl={`${origin}/pay/${collection.publicToken}`}
        qrSvg={qrSvg}
        requestId={collection.requestId}
        requestedAmount={collection.requestedAmount}
        title={collection.title}
        variableSymbol={collection.variableSymbol}
      />
    </div>
  );
}
