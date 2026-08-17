"use client";

import { IncomingDecisionBar } from "@/components/incoming-invoices/incoming-decision-bar";
import { IncomingExceptionBadge } from "@/components/incoming-invoices/incoming-exception-badge";
import { IncomingInvoiceTabs } from "@/components/incoming-invoices/incoming-invoice-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { IncomingQueueCounts } from "@/lib/incoming-invoices/queue-counts";
import { incomingStatusMessageKey } from "@/lib/incoming-invoices/status-message";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

type QueueRow = {
  id: string;
  number: string | null;
  supplierName: string | null;
  status: string;
  paymentState: string;
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
  issuers,
  bankAccounts,
  createRunAction,
}: {
  tab: string;
  counts: IncomingQueueCounts;
  rows: QueueRow[];
  canCreateRun: boolean;
  issuers: Array<{ id: string; name: string }>;
  bankAccounts: Array<{ id: string; label: string; currency: string }>;
  createRunAction: (formData: FormData) => Promise<void>;
}) {
  const t = useTranslations("IncomingInvoices");
  const [selected, setSelected] = useState<string[]>([]);
  const allSelected =
    rows.length > 0 && rows.every((row) => selected.includes(row.id));
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
          {bankAccounts.length === 0 ? (
            <p className="text-sm">
              {t("run.noAccount")}{" "}
              <Link
                className="text-brand underline-offset-2 hover:underline"
                href="/settings/bank-connections"
              >
                {t("run.connectBank")}
              </Link>
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-sm">
                <span>{t("run.issuer")}</span>
                <select
                  name="issuerId"
                  className="border-input h-8 rounded-lg border bg-transparent px-2.5 text-sm"
                >
                  {issuers.map((issuer) => (
                    <option key={issuer.id} value={issuer.id}>
                      {issuer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span>{t("run.account")}</span>
                <select
                  name="bankAccountId"
                  className="border-input h-8 rounded-lg border bg-transparent px-2.5 text-sm"
                >
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label}
                    </option>
                  ))}
                </select>
              </label>
              <input type="hidden" name="currency" value="CZK" />
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
                    aria-label={row.number ?? t("table.number")}
                    checked={selected.includes(row.id)}
                    className="mt-1 size-5 shrink-0"
                    onChange={(event) => {
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, row.id]
                          : current.filter((id) => id !== row.id),
                      );
                    }}
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
                {row.exceptions.slice(0, 2).map((code) => (
                  <IncomingExceptionBadge code={code} key={code} />
                ))}
              </div>
              <IncomingDecisionBar
                invoiceId={row.id}
                pendingTaskId={row.pendingTaskId}
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
                        event.target.checked ? rows.map((row) => row.id) : [],
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
                        type="checkbox"
                        checked={selected.includes(row.id)}
                        onChange={(event) => {
                          setSelected((current) =>
                            event.target.checked
                              ? [...current, row.id]
                              : current.filter((id) => id !== row.id),
                          );
                        }}
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
                      {row.exceptions.slice(0, 2).map((code) => (
                        <IncomingExceptionBadge key={code} code={code} />
                      ))}
                    </div>
                  </td>
                  <td className="bg-card sticky right-0 px-3 py-2">
                    <IncomingDecisionBar
                      invoiceId={row.id}
                      status={row.status}
                      pendingTaskId={row.pendingTaskId}
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
