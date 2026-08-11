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
            Odeslat e-mailem
          </Button>
        }
      />
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Odeslat fakturu</SheetTitle>
          <SheetDescription>
            PDF se připojí vždy. ISDOC lze vypnout.
          </SheetDescription>
        </SheetHeader>

        {!props.emailConfigured ? (
          <p className="text-destructive px-4 text-sm">
            RESEND_API_KEY není nastavený — odeslání nebude fungovat.
          </p>
        ) : null}

        {toSuppressed ? (
          <p className="text-muted-foreground px-4 text-sm">
            Adresa je na suppress seznamu (bounce/complaint). Manuální odeslání
            je stále možné.
          </p>
        ) : null}

        <form action={sendInvoiceEmail} className="space-y-4 px-4 pb-6">
          <input name="id" type="hidden" value={props.invoiceId} />
          <div className="space-y-1.5">
            <Label htmlFor="email-to">Komu</Label>
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
            <Label htmlFor="email-cc">Kopie (volitelné)</Label>
            <Input
              id="email-cc"
              name="cc"
              placeholder="email@example.com, …"
              type="text"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-subject">Předmět</Label>
            <Input
              defaultValue={props.defaultSubject}
              id="email-subject"
              name="subject"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-cover">Text zprávy</Label>
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
            Přiložit ISDOC
          </label>
          <div className="text-muted-foreground space-y-1 text-xs">
            <p>
              <strong>From:</strong> {props.fromPreview}
            </p>
            <p>
              <strong>Reply-To:</strong> {props.replyTo}
            </p>
          </div>
          <Button disabled={!props.emailConfigured} type="submit">
            Odeslat
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
