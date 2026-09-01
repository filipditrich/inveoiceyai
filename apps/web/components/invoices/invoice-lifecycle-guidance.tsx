"use client";

import { useTranslations } from "next-intl";

export type InvoiceLifecycleState =
  | "draft"
  | "unpaid"
  | "partial"
  | "overdue"
  | "paid"
  | "overpaid"
  | "future"
  | "cancelled";

export function resolveInvoiceLifecycleState(
  displayStatus: string,
  paymentState: string,
): InvoiceLifecycleState {
  if (displayStatus === "cancelled") return "cancelled";
  if (displayStatus === "draft") return "draft";
  if (paymentState === "overpaid") return "overpaid";
  if (paymentState === "partial") return "partial";
  if (paymentState === "paid" || displayStatus === "paid") return "paid";
  if (displayStatus === "overdue") return "overdue";
  if (displayStatus === "future") return "future";
  return "unpaid";
}

export function InvoiceLifecycleGuidance({
  displayStatus,
  paymentState,
}: {
  displayStatus: string;
  paymentState: string;
}) {
  const t = useTranslations("Invoices.detail");
  const state = resolveInvoiceLifecycleState(displayStatus, paymentState);
  return (
    <section
      aria-labelledby="lifecycle-guidance"
      className="rounded-xl border bg-muted/40 p-4"
    >
      <h2 className="text-sm font-semibold" id="lifecycle-guidance">
        {t("lifecycleTitle" as never)}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(`lifecycle.${state}.body` as never)}
      </p>
      <p className="mt-2 text-sm font-medium">
        {t(`lifecycle.${state}.action` as never)}
      </p>
    </section>
  );
}
