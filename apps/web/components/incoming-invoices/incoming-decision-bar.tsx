"use client";

import { decideIncomingApprovalAction } from "@/actions/incoming-approvals";
import {
  acceptIncomingInvoiceAction,
  rejectIncomingInvoiceAction,
} from "@/actions/incoming-invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { incomingPaymentAction } from "@/components/incoming-invoices/incoming-invoice-activity";
import { incomingStatusMessageKey } from "@/lib/incoming-invoices/status-message";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

const REVIEWABLE = new Set(["needs_validation", "unsupported", "on_hold"]);

export function IncomingDecisionBar({
  invoiceId,
  status,
  paymentState = "unpaid",
  docType,
  paymentEligible,
  paymentBlocker,
  activePaymentRunId,
  activePaymentRunStatus,
  pendingTaskId,
  nextId,
  variant = "full",
  returnTo,
}: {
  invoiceId: string;
  status: string;
  paymentState?: string;
  docType?: string;
  paymentEligible?: boolean;
  paymentBlocker?: string | null;
  activePaymentRunId?: string | null;
  activePaymentRunStatus?: string | null;
  pendingTaskId?: string | null;
  nextId?: string | null;
  variant?: "full" | "row";
  returnTo?: string;
}) {
  const t = useTranslations("IncomingInvoices");
  const [rejecting, setRejecting] = useState(false);
  const reviewable = REVIEWABLE.has(status);
  const awaitingApproval = status === "pending_approval";
  const paymentAction = incomingPaymentAction({
    status,
    paymentState,
    docType,
    paymentEligible,
    paymentBlocker,
    activePaymentRunId,
    activePaymentRunStatus,
  });
  const readyToPay = paymentAction === "schedule_payment";
  const hasActivePaymentRun =
    paymentAction === "view_payment_run" && Boolean(activePaymentRunId);

  if (variant === "row") {
    return (
      <div className="flex min-w-[12rem] flex-col items-end gap-1.5">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {reviewable ? (
            <form action={acceptIncomingInvoiceAction}>
              <input type="hidden" name="id" value={invoiceId} />
              {returnTo ? (
                <input type="hidden" name="returnTo" value={returnTo} />
              ) : null}
              <SubmitButton size="sm">{t("detail.accept")}</SubmitButton>
            </form>
          ) : null}
          {reviewable ? (
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={() => setRejecting((current) => !current)}
            >
              {t("detail.reject")}
            </Button>
          ) : null}
          {awaitingApproval ? (
            <form action={decideIncomingApprovalAction}>
              <input type="hidden" name="invoiceId" value={invoiceId} />
              <input type="hidden" name="decision" value="approved" />
              {pendingTaskId ? (
                <input type="hidden" name="taskId" value={pendingTaskId} />
              ) : null}
              {returnTo ? (
                <input type="hidden" name="returnTo" value={returnTo} />
              ) : null}
              <SubmitButton size="sm">{t("detail.approve")}</SubmitButton>
            </form>
          ) : null}
          {hasActivePaymentRun ? (
            <Button
              size="sm"
              variant="outline"
              render={
                <Link
                  href={`/incoming-invoices/runs/${activePaymentRunId}`}
                  prefetch
                />
              }
            >
              {t("gate.open")}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={reviewable || awaitingApproval ? "outline" : "default"}
            render={<Link href={`/incoming-invoices/${invoiceId}`} prefetch />}
          >
            {t("gate.open")}
          </Button>
        </div>
        {rejecting ? (
          <form
            action={rejectIncomingInvoiceAction}
            className="flex w-full min-w-[14rem] items-center gap-1.5"
          >
            <input type="hidden" name="id" value={invoiceId} />
            {returnTo ? (
              <input type="hidden" name="returnTo" value={returnTo} />
            ) : null}
            <Input
              name="reason"
              required
              placeholder={t("detail.rejectReason")}
            />
            <SubmitButton size="sm" variant="outline">
              {t("detail.reject")}
            </SubmitButton>
          </form>
        ) : null}
      </div>
    );
  }

  if (reviewable) {
    return (
      <section className="bg-card sticky top-4 z-10 space-y-3 rounded-xl border p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold">{t("gate.reviewTitle")}</h2>
          <p className="text-muted-foreground text-sm">
            {t("gate.reviewHint")}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <form action={acceptIncomingInvoiceAction}>
            <input type="hidden" name="id" value={invoiceId} />
            <SubmitButton>{t("detail.accept")}</SubmitButton>
          </form>
          {nextId ? (
            <form action={acceptIncomingInvoiceAction}>
              <input type="hidden" name="id" value={invoiceId} />
              <input type="hidden" name="nextId" value={nextId} />
              <SubmitButton variant="outline">
                {t("detail.acceptNext")}
              </SubmitButton>
            </form>
          ) : null}
          <form
            action={rejectIncomingInvoiceAction}
            className="flex min-w-[16rem] flex-1 flex-wrap items-end gap-2"
          >
            <input type="hidden" name="id" value={invoiceId} />
            <label className="grid min-w-[12rem] flex-1 gap-1 text-sm">
              <span>{t("detail.rejectReason")}</span>
              <Input name="reason" required />
            </label>
            <SubmitButton variant="outline">{t("detail.reject")}</SubmitButton>
          </form>
        </div>
      </section>
    );
  }

  if (awaitingApproval) {
    return (
      <section className="bg-card sticky top-4 z-10 space-y-3 rounded-xl border p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold">{t("gate.approvalTitle")}</h2>
          <p className="text-muted-foreground text-sm">
            {t("gate.approvalHint")}
          </p>
        </div>
        <form action={decideIncomingApprovalAction} className="space-y-3">
          <input type="hidden" name="invoiceId" value={invoiceId} />
          {pendingTaskId ? (
            <input type="hidden" name="taskId" value={pendingTaskId} />
          ) : null}
          <label className="grid gap-1 text-sm">
            <span>{t("detail.comment")}</span>
            <Input name="comment" placeholder={t("gate.commentHint")} />
          </label>
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="decision" value="approved">
              {t("detail.approve")}
            </SubmitButton>
            <SubmitButton name="decision" value="rejected" variant="outline">
              {t("detail.reject")}
            </SubmitButton>
            <SubmitButton
              name="decision"
              value="changes_requested"
              variant="ghost"
            >
              {t("detail.requestChanges")}
            </SubmitButton>
          </div>
        </form>
      </section>
    );
  }

  if (readyToPay) {
    return (
      <section className="bg-card sticky top-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold">{t("gate.payTitle")}</h2>
          <p className="text-muted-foreground text-sm">{t("gate.payHint")}</p>
        </div>
        <Button render={<Link href="/incoming-invoices?tab=pay" prefetch />}>
          {t("gate.payCta")}
        </Button>
      </section>
    );
  }

  if (paymentAction === "configure_payment") {
    return (
      <section className="bg-card sticky top-4 z-10 space-y-2 rounded-xl border p-4 shadow-sm">
        <h2 className="text-sm font-semibold">{t("gate.configureTitle")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("gate.configureHint")}
        </p>
      </section>
    );
  }

  if (hasActivePaymentRun) {
    return (
      <section className="bg-card sticky top-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold">{t("runs.title")}</h2>
          {activePaymentRunStatus ? (
            <p className="text-muted-foreground text-sm">
              {t(`runs.runStatus.${activePaymentRunStatus}` as never)}
            </p>
          ) : null}
        </div>
        <Button
          render={
            <Link
              href={`/incoming-invoices/runs/${activePaymentRunId}`}
              prefetch
            />
          }
        >
          {t("gate.open")}
        </Button>
      </section>
    );
  }

  if (status === "rejected") {
    return (
      <section className="bg-card rounded-xl border p-4">
        <h2 className="text-sm font-semibold">{t("gate.rejectedTitle")}</h2>
        <p className="text-muted-foreground text-sm">
          {t(incomingStatusMessageKey(status))}
        </p>
      </section>
    );
  }

  if (status === "validated") {
    return (
      <section className="bg-card rounded-xl border p-4">
        <h2 className="text-sm font-semibold">{t("gate.acceptedTitle")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("gate.acceptedHint")}
        </p>
      </section>
    );
  }

  return null;
}
