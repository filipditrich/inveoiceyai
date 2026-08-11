"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/settings", key: "appearance" as const, exact: true },
  { href: "/settings/security", key: "security" as const, exact: false },
  { href: "/settings/members", key: "members" as const, exact: false },
  { href: "/settings/api-keys", key: "apiKeys" as const, exact: false },
];

export function SettingsNav() {
  const pathname = usePathname();
  const t = useTranslations("App.settings");

  return (
    <nav className="flex flex-wrap gap-2 border-b pb-3">
      {LINKS.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-muted text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            {t(`nav.${link.key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
