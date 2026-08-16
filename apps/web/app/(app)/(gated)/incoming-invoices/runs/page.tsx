import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { requireWorkspace } from "@/lib/auth/session";
import { paymentRuns } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { desc, eq } from "drizzle-orm";
import { LandmarkIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function PaymentRunsPage() {
  const [t, { workspaceId }] = await Promise.all([
    getTranslations("IncomingInvoices.runs"),
    requireWorkspace(),
  ]);
  const rows = await db
    .select()
    .from(paymentRuns)
    .where(eq(paymentRuns.workspaceId, workspaceId))
    .orderBy(desc(paymentRuns.createdAt));

  return (
    <div className="space-y-4 px-4 py-6 lg:px-6">
      <PageHeader
        icon={<LandmarkIcon />}
        title={t("title")}
        description={t("subtitle")}
      />
      <div className="overflow-hidden rounded-xl border">
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
                  {t("empty")}
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
                  <td className="px-3 py-2">{row.executionDate}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.totalAmount} {row.currency}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{row.status}</Badge>
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
