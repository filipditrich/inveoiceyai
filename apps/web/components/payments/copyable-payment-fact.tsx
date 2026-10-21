"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export function CopyablePaymentFact({
  label,
  value,
  copyLabel,
}: {
  label: string;
  value: string;
  copyLabel: string;
}) {
  const t = useTranslations("Common.clipboard");
  const [result, setResult] = useState<{
    value: string;
    success: boolean;
  } | null>(null);
  const current = result?.value === value ? result : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setResult({ value, success: true });
    } catch {
      setResult({ value, success: false });
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd
          className={
            current?.success === false
              ? "font-medium break-all whitespace-normal tabular-nums select-text"
              : "truncate font-medium tabular-nums"
          }
        >
          {value}
        </dd>
        <p role="status" className="text-xs text-muted-foreground">
          {current ? t(current.success ? "copied" : "failed") : null}
        </p>
      </div>
      <Button
        aria-label={copyLabel}
        onClick={() => void copy()}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        {current?.success ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  );
}
