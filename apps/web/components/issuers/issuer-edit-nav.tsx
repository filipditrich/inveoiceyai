"use client";

import { NavLinkPending } from "@/components/navigation/nav-link-pending";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = ["identity", "bank", "assets", "numbering", "email"] as const;

export function IssuerEditNav({ issuerId }: { issuerId: string }) {
  const pathname = usePathname();
  const t = useTranslations("Issuers.nav");
  const base = `/issuers/${issuerId}/edit`;

  return (
    <nav className="flex flex-wrap gap-2 border-b pb-3">
      {LINKS.map((href) => {
        const path = `${base}/${href}`;
        const active = pathname === path || pathname.startsWith(`${path}/`);
        return (
          <Link
            key={href}
            href={path}
            prefetch
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            {t(href)}
            <NavLinkPending className="ml-0 size-3" />
          </Link>
        );
      })}
    </nav>
  );
}
