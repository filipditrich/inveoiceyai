"use client";

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
import * as React from "react";

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
  const day = Math.min(28, Math.max(1, defaultDayOfMonth));

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
              defaultValue="monthly"
              id="recurring-cadence"
              name="cadence"
            >
              <option value="monthly">{t("sheet.monthly")}</option>
              <option value="quarterly">{t("sheet.quarterly")}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recurring-day">{t("sheet.dayOfMonth")}</Label>
            <select
              className={selectClassName()}
              defaultValue={String(day)}
              id="recurring-day"
              name="dayOfMonth"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">
              {t("sheet.dayHint")}
            </p>
          </div>
          <SubmitButton pendingLabel={t("sheet.saving")} size="sm">
            {t("sheet.submit")}
          </SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  );
}
