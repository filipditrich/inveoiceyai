"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ActivityIcon,
  LandmarkIcon,
  Building2Icon,
  InboxIcon,
  GiftIcon,
  KeyRoundIcon,
  PlugZapIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "lucide-react";

import { NavLinkPending } from "@/components/navigation/nav-link-pending";
import { cn } from "@/lib/utils";

const YOU_LINKS = [
  {
    href: "/settings",
    key: "account" as const,
    exact: true,
    icon: UserRoundIcon,
  },
  {
    href: "/settings/security",
    key: "security" as const,
    exact: false,
    icon: ShieldCheckIcon,
  },
  {
    href: "/settings/referrals",
    key: "referrals" as const,
    exact: false,
    icon: GiftIcon,
  },
];

const WORKSPACE_LINKS = [
  {
    href: "/settings/workspace",
    key: "workspace" as const,
    exact: false,
    icon: Building2Icon,
  },
  {
    href: "/settings/members",
    key: "members" as const,
    exact: false,
    icon: UsersRoundIcon,
  },
  {
    href: "/settings/usage",
    key: "usage" as const,
    exact: false,
    icon: ActivityIcon,
  },
  {
    href: "/settings/api-keys",
    key: "apiKeys" as const,
    exact: false,
    icon: KeyRoundIcon,
  },
  {
    href: "/settings/incoming-invoices",
    key: "incomingInvoices" as const,
    exact: false,
    icon: InboxIcon,
  },
  {
    href: "/settings/bank-connections",
    key: "bankConnections" as const,
    exact: false,
    icon: LandmarkIcon,
  },
  {
    href: "/settings/integrations",
    key: "integrations" as const,
    exact: false,
    icon: PlugZapIcon,
  },
];

function SettingsNavLinks({
  links,
}: {
  links: typeof YOU_LINKS | typeof WORKSPACE_LINKS;
}) {
  const pathname = usePathname();
  const t = useTranslations("App.settings");

  return (
    <div className="flex gap-1 md:flex-col md:gap-0.5">
      {links.map((link) => {
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
    </div>
  );
}

export function SettingsNav() {
  const t = useTranslations("App.settings");

  return (
    <nav
      aria-label={t("navigationLabel")}
      className="scroll-fade-x -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:sticky md:top-[calc(var(--header-height)+1.5rem)] md:mx-0 md:flex-col md:gap-6 md:overflow-visible md:px-0 md:pb-0"
    >
      {/* `shrink-0` keeps each group at its content width so the nav scrolls
          horizontally on mobile — without it the groups collapse and the
          `shrink-0` links inside overlap each other. */}
      <div className="shrink-0 md:min-w-0 md:shrink">
        <p className="text-muted-foreground mb-1.5 px-3 text-[0.65rem] font-medium uppercase tracking-[0.14em]">
          {t("navGroups.you")}
        </p>
        <SettingsNavLinks links={YOU_LINKS} />
      </div>
      <div className="shrink-0 md:min-w-0 md:shrink">
        <p className="text-muted-foreground mb-1.5 px-3 text-[0.65rem] font-medium uppercase tracking-[0.14em]">
          {t("navGroups.workspace")}
        </p>
        <SettingsNavLinks links={WORKSPACE_LINKS} />
      </div>
    </nav>
  );
}
