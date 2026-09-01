"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { useHeadlessConsentUI } from "@c15t/react";
import { useTranslations } from "next-intl";

export function C15tSettingsLink({
  className,
  children,
  onClick,
  ...props
}: ComponentProps<"button">) {
  const t = useTranslations("Marketing.footer");
  const { openDialog } = useHeadlessConsentUI();

  return (
    <button
      type="button"
      className={cn("text-left", className)}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) openDialog();
      }}
    >
      {children ?? t("cookieSettings")}
    </button>
  );
}
