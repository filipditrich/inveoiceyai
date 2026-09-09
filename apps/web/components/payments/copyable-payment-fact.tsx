"use client";

import { Button } from "@/components/ui/button";
import { CopyIcon } from "lucide-react";

export function CopyablePaymentFact({
  label,
  value,
  copyLabel,
}: {
  label: string;
  value: string;
  copyLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate font-medium tabular-nums">{value}</dd>
      </div>
      <Button
        aria-label={copyLabel}
        onClick={() => void navigator.clipboard.writeText(value)}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <CopyIcon />
      </Button>
    </div>
  );
}
