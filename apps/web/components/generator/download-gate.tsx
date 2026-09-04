"use client";

import * as React from "react";
import { Field } from "@/components/invoices/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  parseIssueResponse,
  type GuestIssueErrorKey,
} from "@/lib/generator/issue-response";
import { useTranslations } from "next-intl";

import type { Invoice } from "@invoicey/invoice-core/schema";

function triggerAttachmentDownload(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function DownloadGate({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Generator");
  const [email, setEmail] = React.useState("");
  const [marketingOptIn, setMarketingOptIn] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [errorKey, setErrorKey] = React.useState<GuestIssueErrorKey | null>(
    null,
  );

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!invoice) {
      setErrorKey("errorInvoice");
      return;
    }
    setPending(true);
    setErrorKey(null);
    try {
      const res = await fetch("/api/generator/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice,
          email,
          marketingOptIn,
        }),
      });
      const body: unknown = await res.json().catch(() => null);
      const parsed = parseIssueResponse(res.status, body);
      if (!parsed.ok) {
        setErrorKey(parsed.errorKey);
        return;
      }
      triggerAttachmentDownload(parsed.downloadUrl, `${parsed.number}.pdf`);
      onOpenChange(false);
    } catch {
      setErrorKey("errorUnavailable");
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("gateTitle")}</SheetTitle>
          <SheetDescription>{t("gateBody")}</SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-1 flex-col gap-4 px-4"
          onSubmit={(ev) => void onSubmit(ev)}
        >
          {errorKey ? (
            <p className="text-sm text-destructive" role="alert">
              {t(errorKey)}
            </p>
          ) : null}
          <Field label={t("gateEmail")}>
            <Input
              autoComplete="email"
              onChange={(ev) => setEmail(ev.target.value)}
              required
              type="email"
              value={email}
            />
          </Field>
          <label className="flex items-start gap-2 text-sm leading-snug">
            <Checkbox
              checked={marketingOptIn}
              className="mt-0.5"
              onCheckedChange={(checked) => setMarketingOptIn(checked === true)}
            />
            {t("gateOptIn")}
          </label>
          <SheetFooter className="px-0">
            <Button disabled={pending} loading={pending} type="submit">
              {pending ? t("downloading") : t("gateSubmit")}
            </Button>
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              {t("gateCancel")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
