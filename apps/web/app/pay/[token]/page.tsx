import { CopyablePaymentFact } from "@/components/payments/copyable-payment-fact";
import { isAppLocale, type AppLocale } from "@/i18n/config";
import { formatMoney } from "@/lib/format";
import { loadPublicPaymentRequest } from "@/lib/payments/payment-request-collection";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { renderSpaydQrSvg } from "@invoicey/invoice-core/spayd";

import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PublicPaymentRequestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [{ token }, t, localeValue] = await Promise.all([
    params,
    getTranslations("PaymentRequests.public"),
    getLocale(),
  ]);
  const locale: AppLocale = isAppLocale(localeValue) ? localeValue : "cs";
  const request = await loadPublicPaymentRequest(token);
  if (!request) notFound();
  const qrSvg = await renderSpaydQrSvg(request.qrPayload);

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col justify-center gap-6 p-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {t("title", { issuer: request.issuerName })}
        </h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(16rem,0.9fr)_minmax(18rem,1.1fr)]">
        <section className="flex items-center justify-center rounded-2xl border bg-white p-5 shadow-sm">
          <div
            aria-label={t("qrLabel")}
            className="aspect-square w-full max-w-sm [&_svg]:size-full"
            // SAFETY: generated locally by the QR library from an escaped SPAYD payload.
            dangerouslySetInnerHTML={{ __html: qrSvg }}
            role="img"
          />
        </section>
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="font-heading text-3xl font-semibold tracking-tight">
            {formatMoney(Number(request.amount), request.currency, locale)}
          </p>
          {request.title ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {request.title}
            </p>
          ) : null}
          <dl className="mt-5 divide-y rounded-xl border bg-background px-4">
            <CopyablePaymentFact
              copyLabel={t("copyAccount")}
              label={t("account")}
              value={request.accountNumber}
            />
            <CopyablePaymentFact
              copyLabel={t("copyIban")}
              label="IBAN"
              value={request.iban}
            />
            <CopyablePaymentFact
              copyLabel={t("copyVariableSymbol")}
              label={t("variableSymbol")}
              value={request.variableSymbol}
            />
          </dl>
        </section>
      </div>
    </main>
  );
}
