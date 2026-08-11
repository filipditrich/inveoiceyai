import type { EmailMessageStatus } from "@invoicey/db";

import { Badge } from "@/components/ui/badge";

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

const STATUS_LABEL: Record<EmailMessageStatus, string> = {
  queued: "Ve frontě",
  sent: "Odesláno",
  delivered: "Doručeno",
  delayed: "Zpožděno",
  bounced: "Nedoručeno",
  failed: "Selhalo",
  complained: "Spam",
};

const EVENT_LABEL: Record<string, string> = {
  sent: "odesláno",
  delivered: "doručeno",
  delivery_delayed: "zpožděno",
  delayed: "zpožděno",
  bounced: "nedoručeno",
  failed: "selhalo",
  complained: "spam",
  opened: "otevřeno",
  clicked: "klik",
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

export function InvoiceEmailTimeline({
  items,
}: {
  items: EmailTimelineItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">E-maily</h2>
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
                {STATUS_LABEL[item.status]}
              </Badge>
            </div>
            {item.events.length > 0 ? (
              <ol className="text-muted-foreground border-t pt-2 text-xs">
                {item.events.map((ev, i) => (
                  <li
                    className="tabular-nums"
                    key={`${item.id}-${i}-${ev.type}`}
                  >
                    {ev.occurredAt.toISOString()} —{" "}
                    {EVENT_LABEL[ev.type] ?? ev.type}
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
