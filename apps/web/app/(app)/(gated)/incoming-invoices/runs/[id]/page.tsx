import {
  confirmPaymentRunAction,
  dropPaymentRunLineAction,
  submitPaymentRunAction,
} from "@/actions/payment-runs";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/session";
import { incomingInvoices, paymentRunLines, paymentRuns } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, eq } from "drizzle-orm";
import { LandmarkIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

export default async function PaymentRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [t, { workspaceId, role }] = await Promise.all([
    getTranslations("IncomingInvoices.runs"),
    requireWorkspace(),
  ]);
  const [run] = await db
    .select()
    .from(paymentRuns)
    .where(
      and(eq(paymentRuns.id, id), eq(paymentRuns.workspaceId, workspaceId)),
    )
    .limit(1);
  if (!run) notFound();
  const lines = await db
    .select()
    .from(paymentRunLines)
    .where(eq(paymentRunLines.paymentRunId, run.id));
  const canManage = role === "admin" || role === "owner";

  return (
    <div className="space-y-4 px-4 py-6 lg:px-6">
      <PageHeader
        icon={<LandmarkIcon />}
        title={run.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{run.status}</Badge>
            <span>
              {run.totalAmount} {run.currency} · {run.executionDate}
            </span>
          </span>
        }
      />
      {run.status === "submitted" || run.status === "submitting" ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          {t("awaitingAuthorization")}
          {run.providerBatchId ? ` · ${run.providerBatchId}` : ""}
        </p>
      ) : null}
      {run.status === "failed" && run.providerMessage ? (
        <p className="text-destructive rounded-xl border p-4 text-sm">
          {run.providerMessage}
        </p>
      ) : null}
      {run.status === "draft" && canManage ? (
        <form action={confirmPaymentRunAction}>
          <input type="hidden" name="runId" value={run.id} />
          <Button type="submit">{t("confirm")}</Button>
        </form>
      ) : null}
      {(run.status === "ready" || run.status === "failed") && canManage ? (
        <form action={submitPaymentRunAction}>
          <input type="hidden" name="runId" value={run.id} />
          <Button type="submit">{t("submit")}</Button>
          <p className="text-muted-foreground mt-2 text-xs">
            {t("submitHint")}
          </p>
        </form>
      ) : null}
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2">{t("beneficiary")}</th>
              <th className="px-3 py-2">{t("amount")}</th>
              <th className="px-3 py-2">{t("rail")}</th>
              <th className="px-3 py-2">{t("status")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-t">
                <td className="px-3 py-2">
                  <Link href={`/incoming-invoices/${line.incomingInvoiceId}`}>
                    {line.beneficiaryName ?? line.incomingInvoiceId.slice(0, 8)}
                  </Link>
                  <div className="text-muted-foreground text-xs">
                    {line.beneficiaryIban ??
                      `${line.beneficiaryAccountNumber ?? ""}/${line.beneficiaryBankCode ?? ""}`}
                  </div>
                </td>
                <td className="px-3 py-2 tabular-nums">
                  {line.amount} {line.currency}
                </td>
                <td className="px-3 py-2">{line.rail}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline">{line.status}</Badge>
                </td>
                <td className="px-3 py-2">
                  {run.status === "draft" &&
                  line.status === "included" &&
                  canManage ? (
                    <form action={dropPaymentRunLineAction}>
                      <input type="hidden" name="lineId" value={line.id} />
                      <input type="hidden" name="runId" value={run.id} />
                      <Button size="sm" type="submit" variant="ghost">
                        {t("drop")}
                      </Button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
