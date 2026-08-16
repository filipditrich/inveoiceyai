"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useState } from "react";

const PREVIEW = 3;

export function AliasHistoryList({ addresses }: { addresses: string[] }) {
  const t = useTranslations("Settings.incomingInvoices");
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? addresses : addresses.slice(0, PREVIEW);

  return (
    <div className="space-y-2">
      <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {t("previousAddresses")}
      </h3>
      <ul className="space-y-2">
        {visible.map((address) => (
          <li
            key={address}
            className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm"
          >
            <code className="break-all">{address}</code>
            <Badge variant="outline">{t("rotated")}</Badge>
          </li>
        ))}
      </ul>
      {addresses.length > PREVIEW ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded
            ? t("hidePrevious")
            : t("showAllPrevious", { count: String(addresses.length) })}
        </Button>
      ) : null}
    </div>
  );
}
