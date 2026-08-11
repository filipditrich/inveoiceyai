"use client";

import { Button } from "@/components/ui/button";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function AdminCopyId({ value }: { value: string }) {
  const t = useTranslations("Admin.table");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /** clipboard may be denied */
    }
  }

  const short =
    value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;

  return (
    <Button
      className="text-muted-foreground hover:text-foreground h-auto gap-1 px-1.5 py-0.5 font-mono text-xs"
      onClick={() => void copy()}
      size="sm"
      title={value}
      type="button"
      variant="ghost"
    >
      <span className="max-w-[9rem] truncate">{short}</span>
      {copied ? (
        <CheckIcon className="size-3.5 shrink-0 text-emerald-600" />
      ) : (
        <CopyIcon className="size-3.5 shrink-0 opacity-60" />
      )}
      <span className="sr-only">{copied ? t("copied") : t("copyId")}</span>
    </Button>
  );
}
