"use client";

import { IncomingDecisionBar } from "@/components/incoming-invoices/incoming-decision-bar";
import { IncomingExceptionBadge } from "@/components/incoming-invoices/incoming-exception-badge";
import { incomingAccountingStateMessageKey } from "@/lib/incoming-invoices/accounting-state-message";
import { IncomingInvoiceTabs } from "@/components/incoming-invoices/incoming-invoice-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { IncomingQueueCounts } from "@/lib/incoming-invoices/queue-counts";
import {
  compatiblePaymentRunAccounts,
  paymentRunSelection,
} from "@/lib/incoming-invoices/payment-run-selection";
import { incomingStatusMessageKey } from "@/lib/incoming-invoices/status-message";
import { incomingNextAction } from "@/components/incoming-invoices/incoming-invoice-activity";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

type QueueRow = {
  id: string;
  number: string | null;
  supplierName: string | null;
  status: string;
  paymentState: string;
  accountingState: string;
  activePaymentRunId: string | null;
  docType: string;
  issuerId: string | null;
  issuerName: string | null;
  currency: string;
  paymentEligible: boolean;
  paymentBlocker: string | null;
  total: string | null;
  dueDate: string | null;
  exceptions: string[];
  mine: boolean;
  pendingTaskId: string | null;
};

export function IncomingInvoiceQueue({
  tab,
  counts,
  rows,
  canCreateRun,
  bankAccounts,
  createRunAction,
}: {
  tab: string;
  counts: IncomingQueueCounts;
  rows: QueueRow[];
  canCreateRun: boolean;
  bankAccounts: Array<{
    id: string;
    label: string;
    currency: string;
    issuerIds: string[];
  }>;
  createRunAction: (formData: FormData) => Promise<void>;
}) {
  const t = useTranslations("IncomingInvoices");
  const [selected, setSelected] = useState<string[]>([]);
  const selection = paymentRunSelection(rows, selected);
  const compatibleIds = new Set(selection.compatibleIds);
  const compatibleAccounts = compatiblePaymentRunAccounts(
    bankAccounts,
    selection.issuerId,
    selection.currency,
  );
  const allSelected =
    selection.compatibleIds.length > 0 &&
    selection.compatibleIds.every((id) => selected.includes(id));
  const emptyLabel =
    tab === "approval"
      ? t("emptyApproval")
      : tab === "pay"
        ? t("emptyPay")
        : tab === "all"
          ? t("empty")
          : t("emptyReview");

  return (
    <div className="space-y-4">
      <IncomingInvoiceTabs
        active={
          tab === "approval" || tab === "pay" || tab === "all" ? tab : "review"
        }
        counts={counts}
      />

      {tab === "pay" && canCreateRun ? (
        <form
          action={createRunAction}
          className="bg-card space-y-3 rounded-xl border p-4"
        >
          {selected.map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}
          <p className="text-muted-foreground text-sm">{t("run.selectHint")}</p>
          {!selection.issuerId || !selection.currency ? (
            <p className="text-muted-foreground text-sm">
              {t("run.selectFirst")}
            </p>
          ) : compatibleAccounts.length === 0 ? (
            <p className="text-sm">
              {t("run.noCompatibleAccount")}{" "}
              <Link
                className="text-foreground font-medium underline underline-offset-2 hover:no-underline"
                href="/settings/bank-connections"
              >
                {t("run.connectBank")}
              </Link>
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="issuerId" value={selection.issuerId} />
              <input type="hidden" name="currency" value={selection.currency} />
              <p className="text-muted-foreground text-sm">
                {t("run.selectionSummary", {
                  issuer:
                    rows.find((row) => row.issuerId === selection.issuerId)
                      ?.issuerName ?? "—",
                  currency: selection.currency,
                })}
              </p>
              <label className="grid gap-1 text-sm">
                <span>{t("run.account")}</span>
                <select
                  name="bankAccountId"
                  className="border-input h-8 rounded-lg border bg-transparent px-2.5 text-sm"
                >
                  {compatibleAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" disabled={selected.length === 0}>
                {t("run.create", { count: String(selected.length) })}
              </Button>
            </div>
          )}
        </form>
      ) : null}

      {/* The table needs 52rem; on a phone that is two screens of sideways
          scrolling for the queue people actually work from. */}
      <ul className="space-y-2 md:hidden">
        {rows.length === 0 ? (
          <li className="text-muted-foreground rounded-xl border px-4 py-8 text-center text-sm">
            {emptyLabel}
          </li>
        ) : (
          rows.map((row) => (
            <li
              className="bg-card space-y-3 rounded-xl border p-3"
              key={row.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    className="block truncate font-medium underline-offset-2 hover:underline"
                    href={`/incoming-invoices/${row.id}`}
                  >
                    {row.number ?? "—"}
                  </Link>
                  <p className="text-muted-foreground truncate text-sm">
                    {row.supplierName ?? "—"}
                  </p>
                </div>
                {tab === "pay" ? (
                  <input
                    aria-label={`${t("table.number")}: ${row.number ?? "—"}`}
                    checked={selected.includes(row.id)}
                    className="mt-1 size-5 shrink-0"
                    disabled={!compatibleIds.has(row.id)}
                    onChange={(event) => {
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, row.id]
                          : current.filter((id) => id !== row.id),
                      );
                    }}
                    title={
                      compatibleIds.has(row.id)
                        ? undefined
                        : t("run.selectionIncompatible")
                    }
                    type="checkbox"
                  />
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium tabular-nums">
                  {row.total ?? "—"}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {t("table.due")} {row.dueDate}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline">
                  {t(incomingStatusMessageKey(row.status))}
                </Badge>
                {row.mine ? <Badge>{t("myTask")}</Badge> : null}
                {row.accountingState === "not_applicable" ? null : (
                  <Badge variant="secondary">
                    {t(incomingAccountingStateMessageKey(row.accountingState))}
                  </Badge>
                )}
                {row.exceptions.slice(0, 2).map((code) => (
                  <IncomingExceptionBadge code={code} key={code} />
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                {t(
                  `nextAction.${incomingNextAction({ status: row.status, paymentState: row.paymentState, exceptions: row.exceptions, docType: row.docType, activePaymentRunId: row.activePaymentRunId, paymentEligible: row.paymentEligible, paymentBlocker: row.paymentBlocker })}` as never,
                )}
              </p>
              <IncomingDecisionBar
                invoiceId={row.id}
                activePaymentRunId={row.activePaymentRunId}
                docType={row.docType}
                paymentEligible={row.paymentEligible}
                paymentBlocker={row.paymentBlocker}
                pendingTaskId={row.pendingTaskId}
                paymentState={row.paymentState}
                returnTo={`/incoming-invoices?tab=${tab}`}
                status={row.status}
                variant="row"
              />
            </li>
          ))
        )}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-left">
            <tr>
              {tab === "pay" ? (
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={t("run.selectAll")}
                    checked={allSelected}
                    onChange={(event) => {
                      setSelected(
                        event.target.checked ? selection.compatibleIds : [],
                      );
                    }}
                  />
                </th>
              ) : null}
              <th className="px-3 py-2">{t("table.number")}</th>
              <th className="px-3 py-2">{t("table.supplier")}</th>
              <th className="px-3 py-2">{t("table.due")}</th>
              <th className="px-3 py-2">{t("table.total")}</th>
              <th className="px-3 py-2">{t("table.status")}</th>
              <th className="bg-muted/50 sticky right-0 px-3 py-2 text-right">
                {t("table.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="text-muted-foreground px-3 py-8 text-center"
                  colSpan={tab === "pay" ? 7 : 6}
                >
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t">
                  {tab === "pay" ? (
                    <td className="px-3 py-2">
                      <input
                        aria-label={`${t("table.number")}: ${row.number ?? "—"}`}
                        disabled={!compatibleIds.has(row.id)}
                        type="checkbox"
                        checked={selected.includes(row.id)}
                        onChange={(event) => {
                          setSelected((current) =>
                            event.target.checked
                              ? [...current, row.id]
                              : current.filter((id) => id !== row.id),
                          );
                        }}
                        title={
                          compatibleIds.has(row.id)
                            ? undefined
                            : t("run.selectionIncompatible")
                        }
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    <Link
                      className="font-medium underline-offset-2 hover:underline"
                      href={`/incoming-invoices/${row.id}`}
                    >
                      {row.number ?? "—"}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.supplierName ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.dueDate}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {row.total ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">
                        {t(incomingStatusMessageKey(row.status))}
                      </Badge>
                      {row.mine ? <Badge>{t("myTask")}</Badge> : null}
                      {row.accountingState === "not_applicable" ? null : (
                        <Badge variant="secondary">
                          {t(
                            incomingAccountingStateMessageKey(
                              row.accountingState,
                            ),
                          )}
                        </Badge>
                      )}
                      {row.accountingState === "not_applicable" ? null : (
                        <Badge variant="secondary">
                          {t(
                            incomingAccountingStateMessageKey(
                              row.accountingState,
                            ),
                          )}
                        </Badge>
                      )}
                      {row.exceptions.slice(0, 2).map((code) => (
                        <IncomingExceptionBadge key={code} code={code} />
                      ))}
                    </div>
                  </td>
                  <td className="bg-card sticky right-0 px-3 py-2">
                    <IncomingDecisionBar
                      invoiceId={row.id}
                      activePaymentRunId={row.activePaymentRunId}
                      docType={row.docType}
                      paymentEligible={row.paymentEligible}
                      paymentBlocker={row.paymentBlocker}
                      status={row.status}
                      pendingTaskId={row.pendingTaskId}
                      paymentState={row.paymentState}
                      variant="row"
                      returnTo={`/incoming-invoices?tab=${tab}`}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
