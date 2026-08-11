import { DISPLAY_STATUS_CARD_ACCENT } from "@/lib/invoice-status-ui";
import { formatMoney } from "@/lib/format";
import {
  DISPLAY_STATUS_LABELS,
  type InvoiceDisplayStatus,
} from "@invoicey/invoice-core/status-display";
import { cn } from "@/lib/utils";
import Link from "next/link";

export type StatusSummaryBucket = {
  status: InvoiceDisplayStatus;
  count: number;
  total: number;
};

function hrefFor(
  status: InvoiceDisplayStatus,
  base: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    if (v) {
      params.set(k, v);
    }
  }
  params.set("status", status);
  params.delete("page");
  return `/invoices?${params.toString()}`;
}

export function InvoiceStatusSummary({
  buckets,
  activeStatus,
  filterBase,
}: {
  buckets: StatusSummaryBucket[];
  activeStatus: InvoiceDisplayStatus | null;
  filterBase: Record<string, string | undefined>;
}) {
  return (
    <div className="@xl/main:grid-cols-3 @5xl/main:grid-cols-6 grid grid-cols-2 gap-3">
      {buckets.map((b) => {
        const active = activeStatus === b.status;
        return (
          <Link
            className={cn(
              "hover:bg-muted/40 rounded-md border px-3 py-3 transition-colors",
              active && "ring-ring ring-2",
              b.status === "cancelled" && "opacity-80",
            )}
            href={hrefFor(b.status, filterBase)}
            key={b.status}
          >
            <div
              className={cn(
                "text-sm font-medium",
                DISPLAY_STATUS_CARD_ACCENT[b.status],
              )}
            >
              {DISPLAY_STATUS_LABELS[b.status]}
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {formatMoney(b.total)}
            </div>
            <div className="text-muted-foreground text-xs tabular-nums">
              {b.count}{" "}
              {b.count === 1
                ? "faktura"
                : b.count >= 2 && b.count <= 4
                  ? "faktury"
                  : "faktur"}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
