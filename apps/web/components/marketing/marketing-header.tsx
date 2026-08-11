import { ArrowRightIcon, MenuIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";

export async function MarketingHeader() {
  const t = await getTranslations("Marketing.nav");
  const tBrand = await getTranslations("App.brand");

  const navItems = [
    { href: "/#jak-to-funguje", label: t("howItWorks") },
    { href: "/#automatizace", label: t("automation") },
    { href: "/#prehled", label: t("capabilities") },
    { href: "/#faq", label: t("faq") },
    { href: "/docs", label: t("docs") },
  ];

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
              {tBrand("tagline")}
            </span>
          </span>
        </Link>

        <nav
          aria-label={t("ariaLabel")}
          className="ml-auto hidden items-center gap-1 lg:flex"
        >
          {navItems.map((item) => (
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
          <LocaleSwitcher size="sm" className="hidden sm:flex" />
          <Button
            variant="ghost"
            className="hidden sm:inline-flex"
            render={<Link href="/sign-in" />}
          >
            {t("signIn")}
          </Button>
          <Button render={<Link href="/dashboard" prefetch={false} />}>
            {t("openApp")}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
          <details className="group relative sm:hidden">
            <summary className="border-input hover:bg-muted focus-visible:ring-ring flex size-9 cursor-pointer list-none items-center justify-center rounded-md border outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
              <MenuIcon className="size-4" aria-hidden="true" />
              <span className="sr-only">Otevřít nabídku</span>
            </summary>
            <nav
              aria-label={t("ariaLabel")}
              className="bg-popover text-popover-foreground absolute right-0 top-11 z-50 w-64 space-y-1 rounded-xl border p-2 shadow-xl"
            >
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="hover:bg-muted block rounded-lg px-3 py-2 text-sm font-medium"
                >
                  {item.label}
                </Link>
              ))}
              <div className="my-2 border-t" />
              <Link
                href="/sign-in"
                className="hover:bg-muted block rounded-lg px-3 py-2 text-sm font-medium"
              >
                {t("signIn")}
              </Link>
              <LocaleSwitcher size="sm" className="mt-1 w-full" />
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
