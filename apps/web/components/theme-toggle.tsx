"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

const THEME_OPTIONS = [
  { value: "light", key: "light" as const, icon: SunIcon },
  { value: "dark", key: "dark" as const, icon: MoonIcon },
  { value: "system", key: "system" as const, icon: MonitorIcon },
] as const;

type ThemeValue = (typeof THEME_OPTIONS)[number]["value"];

function subscribe() {
  return () => {};
}

function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

type ThemeToggleProps = {
  readonly className?: string;
  readonly align?: "start" | "center" | "end";
};

/**
 * Light / dark / system switcher. Preference is stored by next-themes in localStorage.
 */
export function ThemeToggle({ className, align = "end" }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useIsClient();
  const t = useTranslations("App.theme");

  const current = (theme ?? "system") as ThemeValue;
  const resolvedIsDark = resolvedTheme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={t("label")}
            className={cn(className)}
            size="icon-sm"
            title={t("label")}
            variant="ghost"
          />
        }
      >
        {!mounted ? (
          <SunIcon className="size-4 opacity-50" />
        ) : resolvedIsDark ? (
          <MoonIcon className="size-4" />
        ) : (
          <SunIcon className="size-4" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-40" sideOffset={6}>
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(value) => {
            if (value === "light" || value === "dark" || value === "system") {
              setTheme(value);
            }
          }}
        >
          {THEME_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon />
              {t(option.key)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type ThemeModeSwitcherProps = {
  readonly className?: string;
};

/**
 * Compact three-way control for the sidebar footer.
 */
export function ThemeModeSwitcher({ className }: ThemeModeSwitcherProps) {
  const { theme, setTheme } = useTheme();
  const mounted = useIsClient();
  const t = useTranslations("App.theme");
  const current = mounted ? (theme ?? "system") : "system";

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 rounded-xl bg-sidebar-accent/50 p-1 ring-1 ring-sidebar-border/80",
        className,
      )}
      role="group"
      aria-label={t("label")}
    >
      {THEME_OPTIONS.map((option) => {
        const selected = current === option.value;
        const label = t(option.key);
        return (
          <button
            key={option.value}
            type="button"
            aria-label={label}
            aria-pressed={selected}
            title={label}
            className={cn(
              "flex flex-1 items-center justify-center rounded-lg px-2 py-1.5 text-muted-foreground transition-colors hover:text-sidebar-foreground",
              selected &&
                "bg-background text-sidebar-foreground shadow-sm ring-1 ring-sidebar-border",
            )}
            onClick={() => setTheme(option.value)}
          >
            <option.icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
