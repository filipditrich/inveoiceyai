"use client";

import { useState } from "react";
import { addManualPayment } from "@/actions/payments";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { AppLocale } from "@/i18n/config";

export type ManualPaymentInvoice = {
  id: string;
  number: string | null;
  clientName: string;
  currency: string;
  outstanding: string;
};

export function ManualPaymentDialog({
  invoices,
  locale,
  defaultDate,
}: {
  invoices: ManualPaymentInvoice[];
  locale: AppLocale;
  defaultDate: string;
}) {
  const t = useTranslations("Payments");
  const [open, setOpen] = useState(false);
  if (invoices.length === 0) return null;

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button onClick={() => setOpen(true)} type="button">
        <PlusIcon data-icon="inline-start" />
        {t("addPayment")}
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader className="items-start text-left">
          <DialogTitle>{t("manualTitle")}</DialogTitle>
          <DialogDescription>{t("manualDescription")}</DialogDescription>
        </DialogHeader>
        <form action={addManualPayment} className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="invoiceId">{t("invoice")}</Label>
            <select
              id="invoiceId"
              name="invoiceId"
              required
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            >
              {invoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {t("invoiceOption", {
                    number: invoice.number ?? t("draft"),
                    client: invoice.clientName,
                    amount: formatMoney(
                      Number(invoice.outstanding),
                      invoice.currency,
                      locale,
                    ),
                  })}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">{t("amount")}</Label>
              <Input
                id="amount"
                name="amount"
                inputMode="decimal"
                required
                placeholder="1000.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effectiveDate">{t("paidOn")}</Label>
              <Input
                id="effectiveDate"
                name="effectiveDate"
                type="date"
                required
                defaultValue={defaultDate}
              />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button type="submit">
              <PlusIcon /> {t("addPayment")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
