"use client";

import { setLocale } from "@/actions/locale";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppLocale } from "@/i18n/config";
import { SUPPORTED_LOCALES } from "@/i18n/config";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, LanguagesIcon, LoaderCircleIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

type LocaleSwitcherProps = {
  readonly align?: "start" | "center" | "end";
  readonly className?: string;
  /** Icon-only trigger for space-constrained headers. */
  readonly compact?: boolean;
  readonly size?: "default" | "sm";
};

export function LocaleSwitcher({
  align = "end",
  className,
  compact = false,
  size = "default",
}: LocaleSwitcherProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Common.locale");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const currentLabel = t(locale);

  function changeLocale(value: string) {
    if (value === locale || !SUPPORTED_LOCALES.includes(value as AppLocale)) {
      setOpen(false);
      return;
    }
    setOpen(false);
    startTransition(async () => {
      await setLocale(value as AppLocale);
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        disabled={pending}
        render={
          <Button
            aria-label={`${t("label")}: ${currentLabel}`}
            className={cn(compact ? "shrink-0" : "min-w-0 gap-2", className)}
            size={compact ? "icon-sm" : size === "sm" ? "sm" : "default"}
            title={compact ? currentLabel : undefined}
            variant="ghost"
          />
        }
      >
        {pending ? (
          <LoaderCircleIcon className="size-4 animate-spin" />
        ) : (
          <LanguagesIcon className="size-4" />
        )}
        {compact ? null : (
          <>
            <span className="truncate">{currentLabel}</span>
            <ChevronDownIcon className="text-muted-foreground ml-auto size-3.5" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-44" sideOffset={6}>
        <div className="text-muted-foreground px-1.5 py-1 text-xs font-medium">
          {t("label")}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={locale} onValueChange={changeLocale}>
          {SUPPORTED_LOCALES.map((code) => (
            <DropdownMenuRadioItem key={code} value={code}>
              <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <span>{t(code)}</span>
                <span className="text-muted-foreground text-[0.65rem] font-medium uppercase tracking-wider">
                  {code}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
