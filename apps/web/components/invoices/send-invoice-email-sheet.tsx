"use client";

import { sendInvoiceEmail } from "@/actions/invoices";
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
import { MailIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

export type SendInvoiceEmailSheetProps = {
  invoiceId: string;
  defaultTo: string;
  defaultSubject: string;
  defaultCoverText: string;
  defaultAttachIsdoc: boolean;
  fromPreview: string;
  replyTo: string;
  emailConfigured: boolean;
  suppressedEmails?: string[];
};

export function SendInvoiceEmailSheet(props: SendInvoiceEmailSheetProps) {
  const t = useTranslations("Invoices.email");
  const [open, setOpen] = React.useState(false);
  const [to, setTo] = React.useState(props.defaultTo);
  const suppressedSet = new Set(
    (props.suppressedEmails ?? []).map((e) => e.toLowerCase()),
  );
  const toSuppressed = suppressedSet.has(to.trim().toLowerCase());

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button size="sm" type="button" variant="outline">
            <MailIcon data-icon="inline-start" />
            {t("send")}
          </Button>
        }
      />
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        {!props.emailConfigured ? (
          <p className="text-destructive px-4 text-sm">{t("notConfigured")}</p>
        ) : null}

        {toSuppressed ? (
          <p className="text-muted-foreground px-4 text-sm">
            {t("suppressed")}
          </p>
        ) : null}

        <form action={sendInvoiceEmail} className="space-y-4 px-4 pb-6">
          <input name="id" type="hidden" value={props.invoiceId} />
          <div className="space-y-1.5">
            <Label htmlFor="email-to">{t("to")}</Label>
            <Input
              id="email-to"
              name="to"
              onChange={(ev) => {
                setTo(ev.target.value);
              }}
              required
              type="email"
              value={to}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-cc">{t("cc")}</Label>
            <Input
              id="email-cc"
              name="cc"
              placeholder="email@example.com, …"
              type="text"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-subject">{t("subject")}</Label>
            <Input
              defaultValue={props.defaultSubject}
              id="email-subject"
              name="subject"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-cover">{t("coverText")}</Label>
            <textarea
              className="border-input bg-background min-h-32 w-full rounded-md border px-3 py-2 text-sm"
              defaultValue={props.defaultCoverText}
              id="email-cover"
              name="coverText"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              defaultChecked={props.defaultAttachIsdoc}
              name="attachIsdoc"
              type="checkbox"
              value="true"
            />
            {t("attachIsdoc")}
          </label>
          <div className="text-muted-foreground space-y-1 text-xs">
            <p>
              <strong>{t("from")}:</strong> {props.fromPreview}
            </p>
            <p>
              <strong>{t("replyTo")}:</strong> {props.replyTo}
            </p>
          </div>
          <SubmitButton
            disabled={!props.emailConfigured}
            pendingLabel={t("sending")}
          >
            {t("submit")}
          </SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  );
}
