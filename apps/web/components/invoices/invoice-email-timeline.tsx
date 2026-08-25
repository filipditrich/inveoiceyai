"use client";

import type { EmailMessageStatus } from "@invoicey/db";

import { Badge } from "@/components/ui/badge";
import { canResendEmail } from "@/components/invoices/email-preflight";
import { useTranslations } from "next-intl";

export type EmailTimelineEvent = {
  type: string;
  occurredAt: Date;
};

export type EmailTimelineItem = {
  id: string;
  toEmail: string;
  subject: string;
  status: EmailMessageStatus;
  template: string;
  createdAt: Date;
  events: EmailTimelineEvent[];
};

function statusVariant(
  status: EmailMessageStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "bounced":
    case "failed":
    case "complained":
      return "destructive";
    case "delivered":
      return "default";
    case "delayed":
    case "queued":
      return "secondary";
    case "sent":
      return "outline";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

const EMAIL_LABEL_KEYS = [
  "queued",
  "sent",
  "delivered",
  "delayed",
  "failed",
  "opened",
  "clicked",
  "bounced",
  "complained",
] as const;

type EmailLabelKey = (typeof EMAIL_LABEL_KEYS)[number];

function isEmailLabelKey(value: string): value is EmailLabelKey {
  return (EMAIL_LABEL_KEYS as readonly string[]).includes(value);
}

function emailEventKey(type: string): string {
  if (type === "delivery_delayed") {
    return "delayed";
  }
  return type;
}

export function InvoiceEmailTimeline({
  items,
}: {
  items: EmailTimelineItem[];
}) {
  const t = useTranslations("Invoices.detail");
  const tEmail = useTranslations("Status.email");
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">{t("emailHeading")}</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li className="space-y-2 rounded-md border p-3 text-sm" key={item.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium">{item.subject}</p>
                <p className="text-muted-foreground truncate">
                  {item.toEmail} · {item.template}
                </p>
                <p className="text-muted-foreground text-xs tabular-nums">
                  {item.createdAt.toISOString()}
                </p>
              </div>
              <Badge variant={statusVariant(item.status)}>
                {tEmail(item.status)}
              </Badge>
            </div>
            {item.events.length > 0 ? (
              <ol className="text-muted-foreground border-t pt-2 text-xs">
                {item.events.map((ev, i) => {
                  const key = emailEventKey(ev.type);
                  return (
                    <li
                      className="tabular-nums"
                      key={`${item.id}-${i}-${ev.type}`}
                    >
                      {ev.occurredAt.toISOString()} —{" "}
                      {isEmailLabelKey(key) ? tEmail(key) : ev.type}
                    </li>
                  );
                })}
              </ol>
            ) : null}
            {canResendEmail(item.status) ? (
              <p className="text-muted-foreground border-t pt-2 text-xs">
                {t("emailResendHint" as never)}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
