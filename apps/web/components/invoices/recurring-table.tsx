import {
  deleteRecurring,
  runRecurringNow,
  setRecurringPaused,
  skipRecurringNext,
} from "@/actions/recurring";
import { ConfirmForm } from "@/components/confirm-form";
import { TableSurface } from "@/components/layout/table-surface";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInvoiceDate } from "@/lib/format";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import type {
  RecurringCadence,
  RecurringListItem,
} from "@invoicey/invoice-tools/ops";

import type { AppLocale } from "@/i18n/config";

export async function RecurringTable({
  items,
  locale,
}: {
  items: RecurringListItem[];
  locale: AppLocale;
}) {
  const t = await getTranslations("Recurring");

  return (
    <TableSurface>
      <Table className="min-w-[48rem]">
        <TableHeader>
          <TableRow>
            <TableHead>{t("list.name")}</TableHead>
            <TableHead>{t("list.client")}</TableHead>
            <TableHead>{t("list.cadence")}</TableHead>
            <TableHead>{t("list.nextRun")}</TableHead>
            <TableHead>{t("list.lastDraft")}</TableHead>
            <TableHead>{t("list.status")}</TableHead>
            <TableHead>{t("list.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row) => (
            <TableRow className="align-top" key={row.scheduleId}>
              <TableCell>
                <div className="font-medium">{row.name}</div>
                <div className="text-xs text-muted-foreground">
                  {row.issuerName}
                </div>
              </TableCell>
              <TableCell>{row.clientName}</TableCell>
              <TableCell>
                {t(cadenceKey(row.cadence))}
                {row.cadence === "weekly"
                  ? null
                  : ` · ${dayLabel(row.dayOfMonth, {
                      first: t("list.dayFirst"),
                      last: t("list.dayLast"),
                      nth: t("list.day", { day: String(row.dayOfMonth) }),
                    })}`}
              </TableCell>
              <TableCell className="tabular-nums">
                {formatInvoiceDate(row.nextRunOn, locale)}
              </TableCell>
              <TableCell>
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
              </TableCell>
              <TableCell>
                {row.paused ? t("list.paused") : t("list.active")}
              </TableCell>
              <TableCell className="whitespace-normal">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableSurface>
  );
}

export async function RecurringEmpty({
  hasInvoices,
}: {
  hasInvoices: boolean;
}) {
  const t = await getTranslations("Recurring");
  return (
    <div className="rounded-md border border-dashed bg-card p-8 text-center">
      <p className="mb-3 text-sm text-muted-foreground">{t("list.empty")}</p>
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
): "list.weekly" | "list.monthly" | "list.quarterly" | "list.yearly" {
  switch (cadence) {
    case "weekly":
      return "list.weekly";
    case "monthly":
      return "list.monthly";
    case "quarterly":
      return "list.quarterly";
    case "yearly":
      return "list.yearly";
    default: {
      const _exhaustive: never = cadence;
      return _exhaustive;
    }
  }
}

function dayLabel(
  dayOfMonth: number,
  labels: { first: string; last: string; nth: string },
): string {
  if (dayOfMonth >= 31) {
    return labels.last;
  }
  if (dayOfMonth === 1) {
    return labels.first;
  }
  return labels.nth;
}
