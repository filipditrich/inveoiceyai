"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { setLocale } from "@/actions/locale";
import type { AppLocale } from "@/i18n/config";
import { SUPPORTED_LOCALES } from "@/i18n/config";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LocaleSwitcherProps = {
  className?: string;
  /** Compact trigger for headers. */
  size?: "default" | "sm";
};

export function LocaleSwitcher({
  className,
  size = "default",
}: LocaleSwitcherProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Common.locale");
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={locale}
      disabled={pending}
      onValueChange={(value) => {
        if (!value || value === locale) {
          return;
        }
        startTransition(async () => {
          await setLocale(value as AppLocale);
        });
      }}
    >
      <SelectTrigger
        aria-label={t("label")}
        className={cn(size === "sm" ? "h-8 w-[7.5rem]" : "w-[9rem]", className)}
        size={size === "sm" ? "sm" : undefined}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LOCALES.map((code) => (
          <SelectItem key={code} value={code}>
            {t(code)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
