"use client";

import { Badge } from "@/components/ui/badge";
import { DISPLAY_STATUS_BADGE_CLASS } from "@/lib/invoice-status-ui";
import type { InvoiceDisplayStatus } from "@invoicey/invoice-core/status-display";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: InvoiceDisplayStatus;
  className?: string;
}) {
  const t = useTranslations("Status.invoice");
  return (
    <Badge
      className={cn(DISPLAY_STATUS_BADGE_CLASS[status], className)}
      variant="outline"
    >
      {t(status)}
    </Badge>
  );
}
