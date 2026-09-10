import { PublicPaymentRequest } from "@/components/payments/public-payment-request";
import { loadPublicPaymentRequest } from "@/lib/payments/payment-request-collection";
import { notFound } from "next/navigation";

import { renderSpaydQrSvg } from "@invoicey/invoice-core/spayd";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PublicPaymentRequestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const request = await loadPublicPaymentRequest(token);
  if (!request) notFound();
  const qrSvg =
    request.qrPayload === null
      ? null
      : await renderSpaydQrSvg(request.qrPayload);

  return <PublicPaymentRequest qrSvg={qrSvg} request={request} />;
}
