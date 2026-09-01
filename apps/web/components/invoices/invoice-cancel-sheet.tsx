"use client";

import * as React from "react";
import { cancelInvoice } from "@/actions/invoices";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SubmitButton } from "@/components/ui/submit-button";
import { BanIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function InvoiceCancelSheet({
  invoiceId,
  blockedByPayment,
}: {
  invoiceId: string;
  blockedByPayment: boolean;
}) {
  const t = useTranslations("Invoices.detail.cancelSheet");
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button size="sm" type="button" variant="secondary">
            <BanIcon data-icon="inline-start" />
            {t("trigger")}
          </Button>
        }
      />
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6 text-sm">
          <p className="text-muted-foreground">{t("permanent")}</p>
          {blockedByPayment ? (
            <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p>{t("blocked")}</p>
              <Button
                onClick={() => setOpen(false)}
                render={<a href="#payment-ledger" />}
                size="sm"
                variant="outline"
              >
                {t("reviewPayments")}
              </Button>
            </div>
          ) : (
            <form action={cancelInvoice}>
              <input name="id" type="hidden" value={invoiceId} />
              <SubmitButton pendingLabel={t("pending")} variant="destructive">
                <BanIcon data-icon="inline-start" />
                {t("confirm")}
              </SubmitButton>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
