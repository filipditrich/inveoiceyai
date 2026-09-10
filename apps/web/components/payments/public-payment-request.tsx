import { CopyablePaymentFact } from "@/components/payments/copyable-payment-fact";
import { isAppLocale, type AppLocale } from "@/i18n/config";
import { formatDateTime, formatMoney } from "@/lib/format";
import { CheckIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { PublicPaymentRequestView } from "@/lib/payments/public-payment-request";

export async function PublicPaymentRequest({
  request,
  qrSvg,
}: {
  request: PublicPaymentRequestView;
  qrSvg: string | null;
}) {
  const [t, localeValue] = await Promise.all([
    getTranslations("PaymentRequests.public"),
    getLocale(),
  ]);
  const locale: AppLocale = isAppLocale(localeValue) ? localeValue : "cs";
  const requested = formatMoney(
    Number(request.requestedAmount),
    request.currency,
    locale,
  );
  const received = formatMoney(
    Number(request.paidAmount),
    request.currency,
    locale,
  );
  const remaining = formatMoney(
    Number(request.outstandingAmount),
    request.currency,
    locale,
  );

  if (request.settled) {
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col justify-center p-6">
        <section className="rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand text-brand-foreground">
            <CheckIcon aria-hidden className="size-7" />
          </span>
          <p className="mt-5 text-xs font-medium tracking-[0.1em] text-primary uppercase">
            {t("paidEyebrow")}
          </p>
          <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight">
            {t("paidTitle", { issuer: request.issuerName })}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("paidDescription")}
          </p>
          <p className="mt-6 font-heading text-3xl font-semibold tracking-tight">
            {received}
          </p>
          {request.title ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {request.title}
            </p>
          ) : null}
          <dl className="mt-6 divide-y rounded-xl border bg-background px-4 text-left">
            {Number(request.paidAmount) !== Number(request.requestedAmount) ? (
              <PublicPaymentFact label={t("requested")} value={requested} />
            ) : null}
            <PublicPaymentFact
              label={t("variableSymbol")}
              value={request.variableSymbol}
            />
            {request.settledAt ? (
              <PublicPaymentFact
                label={t("paidAt")}
                value={formatDateTime(request.settledAt, locale)}
              />
            ) : null}
          </dl>
        </section>
      </main>
    );
  }

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
          {qrSvg ? (
            <div
              aria-label={t("qrLabel")}
              className="aspect-square w-full max-w-sm [&_svg]:size-full"
              // SAFETY: generated locally by the QR library from an escaped SPAYD payload.
              dangerouslySetInnerHTML={{ __html: qrSvg }}
              role="img"
            />
          ) : null}
        </section>
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="font-heading text-3xl font-semibold tracking-tight">
            {Number(request.paidAmount) > 0 ? remaining : requested}
          </p>
          {request.title ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {request.title}
            </p>
          ) : null}
          {Number(request.paidAmount) > 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("partialNote", { amount: received, remaining })}
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

function PublicPaymentFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium tabular-nums">{value}</dd>
    </div>
  );
}
