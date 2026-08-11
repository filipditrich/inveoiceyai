"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "identity", label: "Identita" },
  { href: "bank", label: "Banka" },
  { href: "assets", label: "Assety" },
  { href: "numbering", label: "Číslování" },
  { href: "email", label: "E-mail" },
] as const;

export function IssuerEditNav({ issuerId }: { issuerId: string }) {
  const pathname = usePathname();
  const base = `/issuers/${issuerId}/edit`;

  return (
    <nav className="flex flex-wrap gap-2 border-b pb-3">
      {LINKS.map((link) => {
        const href = `${base}/${link.href}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={link.href}
            href={href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-muted text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
