"use client";

import { Badge } from "@/components/ui/badge";
import { incomingExceptionMessageKey } from "@/lib/incoming-invoices/exception-message";
import { useTranslations } from "next-intl";

export function IncomingExceptionBadge({ code }: { code: string }) {
  const t = useTranslations("IncomingInvoices");
  return (
    <Badge variant="secondary">
      {t(incomingExceptionMessageKey(code), { code })}
    </Badge>
  );
}
