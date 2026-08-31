"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ActivityIcon,
  Building2Icon,
  GiftIcon,
  KeyRoundIcon,
  LandmarkIcon,
  PlugZapIcon,
  Rows3Icon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { NavLinkPending } from "@/components/navigation/nav-link-pending";
import { cn } from "@/lib/utils";

/**
 * Settings live behind two doors — the avatar menu opens `/settings/account/*`,
 * the workspace switcher opens `/settings/workspace/*` — so each scope shows
 * only its own links. Mixing both in one list was what made "whose setting is
 * this?" ambiguous.
 */
export type SettingsScope = "account" | "workspace";

interface SettingsLink {
  href: string;
  key:
    | "account"
    | "security"
    | "referrals"
    | "workspace"
    | "members"
    | "usage"
    | "apiKeys"
    | "bankConnections"
    | "integrations"
    | "looks";
  exact: boolean;
  icon: LucideIcon;
}

const ACCOUNT_LINKS: SettingsLink[] = [
  {
    href: "/settings/account",
    key: "account",
    exact: true,
    icon: UserRoundIcon,
  },
  {
    href: "/settings/account/security",
    key: "security",
    exact: false,
    icon: ShieldCheckIcon,
  },
  {
    href: "/settings/account/referrals",
    key: "referrals",
    exact: false,
    icon: GiftIcon,
  },
];

const WORKSPACE_LINKS: SettingsLink[] = [
  {
    href: "/settings/workspace",
    key: "workspace",
    exact: true,
    icon: Building2Icon,
  },
  {
    href: "/settings/workspace/members",
    key: "members",
    exact: false,
    icon: UsersRoundIcon,
  },
  {
    href: "/settings/workspace/looks",
    key: "looks",
    exact: false,
    icon: Rows3Icon,
  },
  {
    href: "/settings/workspace/usage",
    key: "usage",
    exact: false,
    icon: ActivityIcon,
  },
  {
    href: "/settings/workspace/api-keys",
    key: "apiKeys",
    exact: false,
    icon: KeyRoundIcon,
  },
  {
    href: "/settings/workspace/bank-connections",
    key: "bankConnections",
    exact: false,
    icon: LandmarkIcon,
  },
  {
    href: "/settings/workspace/integrations",
    key: "integrations",
    exact: false,
    icon: PlugZapIcon,
  },
];

const LINKS_BY_SCOPE: Record<SettingsScope, SettingsLink[]> = {
  account: ACCOUNT_LINKS,
  workspace: WORKSPACE_LINKS,
};

export function SettingsNav({ scope }: { scope: SettingsScope }) {
  const pathname = usePathname();
  const t = useTranslations("App.settings");

  return (
    <nav
      aria-label={t(`navigationLabel.${scope}`)}
      className="scroll-fade-x -mx-4 flex gap-1 overflow-x-auto px-4 pb-2 md:sticky md:top-[calc(var(--header-height)+1.5rem)] md:mx-0 md:flex-col md:gap-0.5 md:overflow-visible md:px-0 md:pb-0"
    >
      {LINKS_BY_SCOPE[scope].map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            prefetch
            className={cn(
              "group flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors md:items-start md:gap-3 md:px-3",
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
            <NavLinkPending className="hidden md:inline" />
          </Link>
        );
      })}
    </nav>
  );
}
