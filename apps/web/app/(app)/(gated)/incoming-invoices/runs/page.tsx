import { IncomingInvoiceTabs } from "@/components/incoming-invoices/incoming-invoice-tabs";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/i18n/config";
import { requireWorkspace } from "@/lib/auth/session";
import { formatInvoiceDate, formatMoneyCode } from "@/lib/format";
import { loadIncomingQueueCounts } from "@/lib/incoming-invoices/queue-counts";
import { runStatusMessageKey } from "@/lib/incoming-invoices/run-status-message";
import { paymentRuns } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { desc, eq } from "drizzle-orm";
import { LandmarkIcon } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

export default async function PaymentRunsPage() {
  const [t, { workspaceId }, locale] = await Promise.all([
    getTranslations("IncomingInvoices.runs"),
    requireWorkspace(),
    getLocale(),
  ]);
  const appLocale = locale as AppLocale;
  const [rows, counts] = await Promise.all([
    db
      .select()
      .from(paymentRuns)
      .where(eq(paymentRuns.workspaceId, workspaceId))
      .orderBy(desc(paymentRuns.createdAt)),
    loadIncomingQueueCounts(workspaceId),
  ]);

  return (
    <div className="space-y-4 px-4 py-6 lg:px-6">
      <PageHeader
        icon={<LandmarkIcon />}
        title={t("title")}
        description={t("subtitle")}
      />
      <IncomingInvoiceTabs active="runs" counts={counts} />
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">{t("name")}</th>
              <th className="px-3 py-2">{t("date")}</th>
              <th className="px-3 py-2">{t("total")}</th>
              <th className="px-3 py-2">{t("status")}</th>
              <th className="px-3 py-2">{t("batch")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="text-muted-foreground px-3 py-8 text-center"
                  colSpan={5}
                >
                  <p>{t("empty")}</p>
                  <p className="mt-2">
                    <Button
                      size="sm"
                      render={
                        <Link href="/incoming-invoices?tab=pay" prefetch />
                      }
                    >
                      {t("goToPay")}
                    </Button>
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link
                      className="font-medium underline-offset-2 hover:underline"
                      href={`/incoming-invoices/runs/${row.id}`}
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {formatInvoiceDate(row.executionDate, appLocale)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatMoneyCode(
                      Number(row.totalAmount),
                      row.currency,
                      appLocale,
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">
                      {t(runStatusMessageKey(row.status))}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">{row.providerBatchId ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
