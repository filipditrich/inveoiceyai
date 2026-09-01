"use client";

import { useTranslations } from "next-intl";

export function LastValueHint({
  value,
  label,
  onApply,
}: {
  value?: string;
  label?: string;
  onApply: () => void;
}) {
  const t = useTranslations("Invoices.builder");
  return (
    <button
      className="w-fit text-left text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      onClick={onApply}
      type="button"
    >
      {label ?? t("useLast", { value: value ?? "" })}
    </button>
  );
}
