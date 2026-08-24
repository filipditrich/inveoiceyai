"use client";

import { bulkCancelInvoice } from "@/actions/invoices";
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
import { XCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

export function BulkCancelSheet({
  ids,
  disabled,
}: {
  ids: string[];
  disabled: boolean;
}) {
  const t = useTranslations("Invoices.list");
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            disabled={disabled}
            size="sm"
            type="button"
            variant="secondary"
          >
            {t("bulkCancel")}
          </Button>
        }
      />
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("bulkCancelTitle")}</SheetTitle>
          <SheetDescription>{t("bulkCancelDescription")}</SheetDescription>
        </SheetHeader>
        <form action={bulkCancelInvoice} className="space-y-4 px-4 pb-6">
          {ids.map((id) => (
            <input key={id} name="ids" type="hidden" value={id} />
          ))}
          <p className="text-muted-foreground text-sm">
            {t("bulkCancelPermanent")}
          </p>
          <SubmitButton
            pendingLabel={t("bulkCancelPending")}
            variant="destructive"
          >
            <XCircleIcon data-icon="inline-start" />
            {t("bulkCancelConfirm", { count: ids.length })}
          </SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  );
}
