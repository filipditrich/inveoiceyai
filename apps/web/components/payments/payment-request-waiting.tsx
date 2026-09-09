"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { isAppLocale, type AppLocale } from "@/i18n/config";
import { formatMoney } from "@/lib/format";
import {
  InvoiceCollectionStatusSchema,
  type InvoiceCollectionStatus,
} from "@/lib/payments/invoice-collection-status";
import { CheckIcon, CopyIcon, LoaderCircleIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

const HEARTBEAT_INTERVAL_MS = 2_500;

type RequestDetails = {
  requestId: string;
  title: string;
  currency: "CZK";
  accountNumber: string;
  iban: string;
  variableSymbol: string;
  requestedAmount: string;
  qrSvg: string;
  publicUrl: string;
  initialStatus: InvoiceCollectionStatus;
};

export function PaymentRequestWaiting(details: RequestDetails) {
  const t = useTranslations("PaymentRequests.wait");
  const localeValue = useLocale();
  const locale: AppLocale = isAppLocale(localeValue) ? localeValue : "cs";
  const [status, setStatus] = useState(details.initialStatus);
  const [refreshInterrupted, setRefreshInterrupted] = useState(false);

  // A watch heartbeat is an external subscription with deliberate polling;
  // the connection lease deduplicates React Strict Mode and concurrent tabs.
  // oxlint-disable-next-line react-doctor/no-fetch-in-effect
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function heartbeat(): Promise<void> {
      try {
        const response = await fetch(
          `/api/payments/requests/${details.requestId}/status`,
          { method: "POST", cache: "no-store" },
        );
        if (!response.ok) throw new Error(`request_status_${response.status}`);
        const next = InvoiceCollectionStatusSchema.parse(await response.json());
        if (!active) return;
        setStatus(next);
        setRefreshInterrupted(false);
        if (next.settled) return;
      } catch {
        if (!active) return;
        setRefreshInterrupted(true);
      }
      timer = setTimeout(heartbeat, HEARTBEAT_INTERVAL_MS);
    }

    if (!status.settled) void heartbeat();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [details.requestId, status.settled]);

  const received = Number(status.paidAmount);
  const requested = Number(details.requestedAmount);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(18rem,0.9fr)_minmax(20rem,1.1fr)]">
      <section className="flex items-center justify-center rounded-2xl border bg-white p-5 shadow-sm sm:p-8">
        <div
          aria-label={t("qrLabel")}
          className="aspect-square w-full max-w-md [&_svg]:size-full"
          // SAFETY: generated locally by the QR library from an escaped SPAYD payload.
          dangerouslySetInnerHTML={{ __html: details.qrSvg }}
          role="img"
        />
      </section>

      <section className="flex flex-col justify-between gap-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">
              {details.title || t("untitled")}
            </p>
            <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              {formatMoney(requested, details.currency, locale)}
            </h2>
          </div>

          <dl className="divide-y rounded-xl border bg-background px-4">
            <PaymentFact
              label={t("account")}
              value={details.accountNumber}
              copyLabel={t("copyAccount")}
            />
            <PaymentFact
              label="IBAN"
              value={details.iban}
              copyLabel={t("copyIban")}
            />
            <PaymentFact
              label={t("variableSymbol")}
              value={details.variableSymbol}
              copyLabel={t("copyVariableSymbol")}
            />
            <PaymentFact
              label={t("publicLink")}
              value={details.publicUrl}
              copyLabel={t("copyLink")}
            />
          </dl>
        </div>

        <div
          aria-live="polite"
          className="rounded-xl bg-brand/[0.08] p-4 ring-1 ring-brand/15"
        >
          {status.settled ? (
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
                <CheckIcon className="size-5" />
              </span>
              <div>
                <p className="font-heading text-lg font-medium">
                  {t("received")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("receivedBody", {
                    amount: formatMoney(received, details.currency, locale),
                  })}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <LoaderCircleIcon className="mt-0.5 size-5 shrink-0 animate-spin text-brand" />
              <div>
                <p className="font-medium">
                  {received > 0
                    ? t("partiallyReceived", {
                        amount: formatMoney(received, details.currency, locale),
                      })
                    : t("waiting")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {refreshInterrupted
                    ? t("refreshInterrupted")
                    : t("waitingBody")}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PaymentFact({
  label,
  value,
  copyLabel,
}: {
  label: string;
  value: string;
  copyLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate font-medium tabular-nums">{value}</dd>
      </div>
      <Button
        aria-label={copyLabel}
        onClick={() => void navigator.clipboard.writeText(value)}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <CopyIcon />
      </Button>
    </div>
  );
}
