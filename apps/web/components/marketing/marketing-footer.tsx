import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { C15tSettingsLink } from "@/features/c15t";

export function MarketingFooter() {
  return (
    <footer className="bg-muted/25 border-t">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between lg:px-8">
        <div className="max-w-md">
          <Link
            href="/"
            className="focus-visible:ring-3 focus-visible:ring-ring/50 inline-flex items-center gap-2.5 rounded-xl outline-none"
          >
            <BrandLogo size={32} />
            <span className="font-semibold tracking-tight">Invoicey</span>
          </Link>
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            České faktury jako strukturovaná data. Vytvořte je ve webu, přes
            JSON nebo s pomocí AI a pokaždé získejte stejný validovaný výstup.
          </p>
        </div>

        <div className="space-y-3 md:text-right">
          <nav
            aria-label="Právní informace"
            className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 text-sm md:justify-end"
          >
            <Link
              className="hover:text-foreground transition-colors"
              href="/docs"
            >
              Dokumentace
            </Link>
            <Link
              className="hover:text-foreground transition-colors"
              href="/privacy"
            >
              Soukromí
            </Link>
            <Link
              className="hover:text-foreground transition-colors"
              href="/terms"
            >
              Podmínky
            </Link>
            <Link
              className="hover:text-foreground transition-colors"
              href="/cookies"
            >
              Cookies
            </Link>
            <C15tSettingsLink className="hover:text-foreground transition-colors">
              Nastavení cookies
            </C15tSettingsLink>
          </nav>
          <p className="text-muted-foreground text-xs">
            © {new Date().getFullYear()} Invoicey · Neveřejná beta
          </p>
        </div>
      </div>
    </footer>
  );
}
