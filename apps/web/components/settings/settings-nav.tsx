"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Building2Icon,
  GiftIcon,
  KeyRoundIcon,
  PaletteIcon,
  PlugZapIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS = [
  {
    href: "/settings",
    key: "appearance" as const,
    exact: true,
    icon: PaletteIcon,
  },
  {
    href: "/settings/workspace",
    key: "workspace" as const,
    exact: false,
    icon: Building2Icon,
  },
  {
    href: "/settings/security",
    key: "security" as const,
    exact: false,
    icon: ShieldCheckIcon,
  },
  {
    href: "/settings/members",
    key: "members" as const,
    exact: false,
    icon: UsersRoundIcon,
  },
  {
    href: "/settings/referrals",
    key: "referrals" as const,
    exact: false,
    icon: GiftIcon,
  },
  {
    href: "/settings/api-keys",
    key: "apiKeys" as const,
    exact: false,
    icon: KeyRoundIcon,
  },
  {
    href: "/settings/integrations",
    key: "integrations" as const,
    exact: false,
    icon: PlugZapIcon,
  },
];

export function SettingsNav() {
  const pathname = usePathname();
  const t = useTranslations("App.settings");

  return (
    <nav
      aria-label={t("navigationLabel")}
      className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 md:sticky md:top-[calc(var(--header-height)+1.5rem)] md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0"
    >
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "group flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors md:items-start md:gap-3 md:px-3 md:py-2.5",
              active
                ? "bg-brand/10 text-foreground ring-brand/15 font-medium ring-1"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon
              className={cn(
                "mt-0.5 size-4 shrink-0",
                active ? "text-brand" : "group-hover:text-foreground",
              )}
            />
            <span className="min-w-0">
              <span className="block whitespace-nowrap">
                {t(`nav.${link.key}`)}
              </span>
              <span className="text-muted-foreground mt-0.5 hidden text-xs font-normal leading-snug md:block">
                {t(`navDescriptions.${link.key}`)}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
