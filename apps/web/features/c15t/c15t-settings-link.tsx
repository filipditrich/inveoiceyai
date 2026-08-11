"use client";

import { useHeadlessConsentUI } from "@c15t/react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function C15tSettingsLink({
  className,
  children = "Nastavení cookies",
  onClick,
  ...props
}: ComponentProps<"button">) {
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
      {children}
    </button>
  );
}
