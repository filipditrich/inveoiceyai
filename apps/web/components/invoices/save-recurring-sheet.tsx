"use client";

import * as React from "react";
import { saveRecurringFromInvoice } from "@/actions/recurring";
import { selectClassName } from "@/components/invoices/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import { RepeatIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { RecurringCadence } from "@invoicey/invoice-tools/ops";

function dayPreset(sourceDay: number): number {
  if (sourceDay >= 29) {
    return 31;
  }
  return Math.min(28, Math.max(1, sourceDay));
}

export function SaveRecurringSheet({
  invoiceId,
  defaultName,
  defaultDayOfMonth,
}: {
  invoiceId: string;
  defaultName: string;
  defaultDayOfMonth: number;
}) {
  const t = useTranslations("Recurring");
  const [open, setOpen] = React.useState(false);
  const [cadence, setCadence] = React.useState<RecurringCadence>("monthly");
  const sourceDay = dayPreset(defaultDayOfMonth);
  const extraDay = sourceDay !== 1 && sourceDay !== 15 && sourceDay !== 31;

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger
        render={
          <Button size="sm" type="button" variant="outline">
            <RepeatIcon data-icon="inline-start" />
            {t("sheet.trigger")}
          </Button>
        }
      />
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("sheet.title")}</SheetTitle>
          <SheetDescription>{t("sheet.description")}</SheetDescription>
        </SheetHeader>
        <form action={saveRecurringFromInvoice} className="space-y-4 px-4 pb-6">
          <input name="invoiceId" type="hidden" value={invoiceId} />
          <div className="space-y-1.5">
            <Label htmlFor="recurring-name">{t("sheet.name")}</Label>
            <Input
              defaultValue={defaultName}
              id="recurring-name"
              name="name"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recurring-cadence">{t("sheet.cadence")}</Label>
            <select
              className={selectClassName()}
              id="recurring-cadence"
              name="cadence"
              onChange={(event) => {
                setCadence(event.target.value as RecurringCadence);
              }}
              value={cadence}
            >
              <option value="weekly">{t("sheet.weekly")}</option>
              <option value="monthly">{t("sheet.monthly")}</option>
              <option value="quarterly">{t("sheet.quarterly")}</option>
              <option value="yearly">{t("sheet.yearly")}</option>
            </select>
          </div>
          {cadence === "weekly" ? (
            <input name="dayOfMonth" type="hidden" value="1" />
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="recurring-day">{t("sheet.dayOfMonth")}</Label>
              <select
                className={selectClassName()}
                defaultValue={String(sourceDay >= 29 ? 31 : sourceDay)}
                id="recurring-day"
                name="dayOfMonth"
              >
                <option value="1">{t("sheet.dayFirst")}</option>
                {extraDay ? (
                  <option value={String(sourceDay)}>
                    {t("sheet.dayNth", { day: String(sourceDay) })}
                  </option>
                ) : null}
                <option value="15">{t("sheet.dayFifteenth")}</option>
                <option value="31">{t("sheet.dayLast")}</option>
              </select>
            </div>
          )}
          <SubmitButton pendingLabel={t("sheet.saving")} size="sm">
            {t("sheet.submit")}
          </SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  );
}
