"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * App-wide toast chrome. Keeps surfaces on design tokens — no Sonner
 * `richColors` neon fills — and parks the close control top-right.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
        ),
        info: <InfoIcon className="size-4 text-sky-600 dark:text-sky-400" />,
        warning: (
          <TriangleAlertIcon className="size-4 text-amber-600 dark:text-amber-400" />
        ),
        error: (
          <OctagonXIcon className="size-4 text-red-600 dark:text-red-400" />
        ),
        loading: (
          <Loader2Icon className="text-muted-foreground size-4 animate-spin" />
        ),
        close: <XIcon className="size-3.5" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast group/toast border-border bg-popover text-popover-foreground gap-3 rounded-xl border px-4 py-3 shadow-lg ring-1 ring-black/5 dark:ring-white/10",
          title: "text-foreground text-sm font-medium tracking-tight",
          description: "text-muted-foreground text-sm leading-relaxed",
          icon: "mt-0.5 self-start",
          content: "gap-0.5",
          closeButton:
            "!left-auto !right-1 !top-1 !translate-x-0 !translate-y-0 !border-border !bg-popover !text-muted-foreground hover:!bg-muted hover:!text-foreground size-6 rounded-md border shadow-none",
          success: "border-border",
          warning: "border-border",
          error: "border-border",
          info: "border-border",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
