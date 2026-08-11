import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/#jak-to-funguje", label: "Jak to funguje" },
  { href: "/#automatizace", label: "Automatizace" },
  { href: "/#prehled", label: "Co umí" },
  { href: "/#faq", label: "Otázky" },
] as const;

export function MarketingHeader() {
  return (
    <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="focus-visible:ring-3 focus-visible:ring-ring/50 group flex shrink-0 items-center gap-2.5 rounded-xl outline-none"
        >
          <BrandLogo
            size={34}
            priority
            className="shadow-sm transition-transform group-hover:-rotate-2"
          />
          <span className="leading-none">
            <span className="block text-base font-semibold tracking-tight">
              Invoicey
            </span>
            <span className="text-muted-foreground mt-1 block text-[0.65rem] tracking-wide">
              Czech invoicing
            </span>
          </span>
        </Link>

        <nav
          aria-label="Hlavní navigace"
          className="ml-auto hidden items-center gap-1 lg:flex"
        >
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-2">
          <Button
            variant="ghost"
            className="hidden sm:inline-flex"
            render={<Link href="/sign-in" />}
          >
            Přihlásit se
          </Button>
          <Button render={<Link href="/dashboard" prefetch={false} />}>
            Otevřít aplikaci
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </header>
  );
}
