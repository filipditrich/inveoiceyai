"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { incomingStatusMessageKey } from "@/lib/incoming-invoices/status-message";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type QueueRow = {
  id: string;
  number: string | null;
  supplierName: string | null;
  status: string;
  paymentState: string;
  total: string | null;
  currency: string;
  dueDate: string | null;
  exceptions: string[];
  mine: boolean;
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
  counts: { review: number; approval: number; pay: number; all: number };
  rows: QueueRow[];
  canCreateRun: boolean;
  issuers: Array<{ id: string; name: string }>;
  bankAccounts: Array<{ id: string; label: string; currency: string }>;
  createRunAction: (formData: FormData) => Promise<void>;
}) {
  const t = useTranslations("IncomingInvoices");
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  function setTab(next: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    router.push(`${url.pathname}?${url.searchParams.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["review", counts.review],
            ["approval", counts.approval],
            ["pay", counts.pay],
            ["all", counts.all],
          ] as const
        ).map(([key, count]) => (
          <Button
            key={key}
            size="sm"
            variant={tab === key ? "default" : "outline"}
            onClick={() => setTab(key)}
          >
            {t(`tabs.${key}`)}
            <Badge variant="secondary">{count}</Badge>
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          render={<Link href="/incoming-invoices/inbox" prefetch />}
        >
          {t("tabs.inbox")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          render={<Link href="/incoming-invoices/runs" prefetch />}
        >
          {t("tabs.runs")}
        </Button>
      </div>

      {tab === "pay" && canCreateRun ? (
        <form
          action={createRunAction}
          className="bg-card flex flex-wrap items-end gap-3 rounded-xl border p-4"
        >
          {selected.map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}
          <label className="grid gap-1 text-sm">
            <span>{t("run.issuer")}</span>
            <select
              name="issuerId"
              className="border-input rounded-md border px-2 py-1.5"
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
              className="border-input rounded-md border px-2 py-1.5"
            >
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="currency" value="CZK" />
          <Button
            type="submit"
            disabled={selected.length === 0 || bankAccounts.length === 0}
          >
            {t("run.create", { count: String(selected.length) })}
          </Button>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-left">
            <tr>
              {tab === "pay" ? <th className="w-10 px-3 py-2" /> : null}
              <th className="px-3 py-2">{t("table.number")}</th>
              <th className="px-3 py-2">{t("table.supplier")}</th>
              <th className="px-3 py-2">{t("table.due")}</th>
              <th className="px-3 py-2">{t("table.total")}</th>
              <th className="px-3 py-2">{t("table.status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="text-muted-foreground px-3 py-8 text-center"
                  colSpan={6}
                >
                  {t("empty")}
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
                  <td className="px-3 py-2">{row.dueDate ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.total ?? "—"} {row.currency}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">
                        {t(incomingStatusMessageKey(row.status))}
                      </Badge>
                      {row.mine ? <Badge>{t("myTask")}</Badge> : null}
                      {row.exceptions.slice(0, 2).map((code) => (
                        <Badge key={code} variant="secondary">
                          {code}
                        </Badge>
                      ))}
                    </div>
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
