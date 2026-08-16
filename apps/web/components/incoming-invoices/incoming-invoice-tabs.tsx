"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { IncomingQueueCounts } from "@/lib/incoming-invoices/queue-counts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function IncomingInvoiceTabs({
  active,
  counts,
}: {
  active: "review" | "approval" | "pay" | "all" | "inbox" | "runs";
  counts: IncomingQueueCounts;
}) {
  const t = useTranslations("IncomingInvoices");
  const router = useRouter();

  function setTab(next: "review" | "approval" | "pay" | "all") {
    router.push(`/incoming-invoices?tab=${next}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(
        [
          ["review", counts.review],
          ["approval", counts.approval],
          ["pay", counts.pay],
          ["all", counts.all],
        ] as const
      ).map(([key, count]) => (
        <Button
          key={key}
          size="sm"
          variant={active === key ? "default" : "outline"}
          onClick={() => setTab(key)}
        >
          {t(`tabs.${key}`)}
          <Badge variant="secondary">{count}</Badge>
        </Button>
      ))}
      <Button
        size="sm"
        variant={active === "inbox" ? "default" : "ghost"}
        render={<Link href="/incoming-invoices/inbox" prefetch />}
      >
        {t("tabs.inbox")}
      </Button>
      <Button
        size="sm"
        variant={active === "runs" ? "default" : "ghost"}
        render={<Link href="/incoming-invoices/runs" prefetch />}
      >
        {t("tabs.runs")}
      </Button>
    </div>
  );
}
