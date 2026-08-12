import {
  deleteRecurring,
  runRecurringNow,
  setRecurringPaused,
  skipRecurringNext,
} from "@/actions/recurring";
import { ConfirmForm } from "@/components/confirm-form";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatInvoiceDate } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";
import type {
  RecurringCadence,
  RecurringListItem,
} from "@invoicey/invoice-tools/ops";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function RecurringTable({
  items,
  locale,
}: {
  items: RecurringListItem[];
  locale: AppLocale;
}) {
  const t = await getTranslations("Recurring");

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[48rem] text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-3 font-medium">{t("list.name")}</th>
            <th className="p-3 font-medium">{t("list.client")}</th>
            <th className="p-3 font-medium">{t("list.cadence")}</th>
            <th className="p-3 font-medium">{t("list.nextRun")}</th>
            <th className="p-3 font-medium">{t("list.lastDraft")}</th>
            <th className="p-3 font-medium">{t("list.status")}</th>
            <th className="p-3 font-medium">{t("list.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr className="border-b align-top" key={row.scheduleId}>
              <td className="p-3">
                <div className="font-medium">{row.name}</div>
                <div className="text-muted-foreground text-xs">
                  {row.issuerName}
                </div>
              </td>
              <td className="p-3">{row.clientName}</td>
              <td className="p-3">
                {t(cadenceKey(row.cadence))} ·{" "}
                {t("list.day", { day: String(row.dayOfMonth) })}
              </td>
              <td className="p-3 tabular-nums">
                {formatInvoiceDate(row.nextRunOn, locale)}
              </td>
              <td className="p-3">
                {row.lastInvoiceId ? (
                  <Link
                    className="underline"
                    href={`/invoices/${row.lastInvoiceId}`}
                    prefetch
                  >
                    {formatInvoiceDate(row.lastRunOn, locale)}
                  </Link>
                ) : (
                  t("list.never")
                )}
              </td>
              <td className="p-3">
                {row.paused ? t("list.paused") : t("list.active")}
              </td>
              <td className="p-3">
                <div className="flex flex-wrap gap-1.5">
                  <form action={setRecurringPaused}>
                    <input
                      name="scheduleId"
                      type="hidden"
                      value={row.scheduleId}
                    />
                    <input
                      name="paused"
                      type="hidden"
                      value={row.paused ? "0" : "1"}
                    />
                    <SubmitButton
                      pendingLabel={t("list.saving")}
                      size="sm"
                      variant="outline"
                    >
                      {row.paused ? t("list.resume") : t("list.pause")}
                    </SubmitButton>
                  </form>
                  <form action={skipRecurringNext}>
                    <input
                      name="scheduleId"
                      type="hidden"
                      value={row.scheduleId}
                    />
                    <SubmitButton
                      pendingLabel={t("list.saving")}
                      size="sm"
                      variant="outline"
                    >
                      {t("list.skip")}
                    </SubmitButton>
                  </form>
                  <form action={runRecurringNow}>
                    <input
                      name="scheduleId"
                      type="hidden"
                      value={row.scheduleId}
                    />
                    <SubmitButton
                      pendingLabel={t("list.running")}
                      size="sm"
                      variant="outline"
                    >
                      {t("list.runNow")}
                    </SubmitButton>
                  </form>
                  <ConfirmForm
                    action={deleteRecurring}
                    message={t("list.deleteConfirm")}
                  >
                    <input
                      name="templateId"
                      type="hidden"
                      value={row.templateId}
                    />
                    <SubmitButton
                      pendingLabel={t("list.deleting")}
                      size="sm"
                      variant="destructive"
                    >
                      {t("list.delete")}
                    </SubmitButton>
                  </ConfirmForm>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function RecurringEmpty({
  hasInvoices,
}: {
  hasInvoices: boolean;
}) {
  const t = await getTranslations("Recurring");
  return (
    <div className="rounded-md border border-dashed p-8 text-center">
      <p className="text-muted-foreground mb-3 text-sm">{t("list.empty")}</p>
      {hasInvoices ? (
        <Button render={<Link href="/invoices" prefetch />} size="sm">
          {t("list.emptyCta")}
        </Button>
      ) : (
        <Button render={<Link href="/invoices/new" prefetch />} size="sm">
          {t("list.createFirst")}
        </Button>
      )}
    </div>
  );
}

function cadenceKey(
  cadence: RecurringCadence,
): "list.monthly" | "list.quarterly" {
  switch (cadence) {
    case "monthly":
      return "list.monthly";
    case "quarterly":
      return "list.quarterly";
    default: {
      const _exhaustive: never = cadence;
      return _exhaustive;
    }
  }
}
