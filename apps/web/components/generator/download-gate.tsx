"use client";

import * as React from "react";
import { Field } from "@/components/invoices/field";
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
import {
  parseIssueResponse,
  type GuestIssueErrorKey,
} from "@/lib/generator/issue-response";
import { DownloadIcon, MailIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

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
          marketingOptIn: false,
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
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <span className="grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
            <MailIcon className="size-5" />
          </span>
          <DialogTitle>{t("gateTitle")}</DialogTitle>
          <DialogDescription>{t("gateBody")}</DialogDescription>
        </DialogHeader>
        <form className="mt-5 space-y-4" onSubmit={(ev) => void onSubmit(ev)}>
          {errorKey ? (
            <p className="text-sm text-destructive" role="alert">
              {t(errorKey)}
            </p>
          ) : null}
          <Field label={t("gateEmail")}>
            <Input
              autoComplete="email"
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder={t("gateEmailPlaceholder")}
              required
              type="email"
              value={email}
            />
          </Field>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t.rich("gateLegal", {
              terms: (chunks) => (
                <Link
                  className="text-foreground underline-offset-4 hover:underline"
                  href="/terms"
                >
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link
                  className="text-foreground underline-offset-4 hover:underline"
                  href="/privacy"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
          <DialogFooter>
            <Button
              className="w-full"
              disabled={pending}
              loading={pending}
              size="lg"
              type="submit"
            >
              <DownloadIcon />
              {pending ? t("downloading") : t("gateSubmit")}
            </Button>
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              {t("gateCancel")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
