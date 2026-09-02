import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { getOptionalSession } from "@/lib/auth/session";
import { ArrowRightIcon, MenuIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import {
  MarketingSignedInChip,
  sessionDisplayName,
} from "./marketing-signed-in";

export async function MarketingHeader() {
  const t = await getTranslations("Marketing.nav");
  const tBrand = await getTranslations("App.brand");
  const user = await getOptionalSession();

  const navItems = [
    { href: "/#jak-to-funguje", label: t("howItWorks") },
    { href: "/#prehled", label: t("capabilities") },
    { href: "/#platby", label: t("payments") },
    { href: "/#automatizace", label: t("automation") },
    { href: "/#napojeni", label: t("integrations") },
    { href: "/#apps", label: t("apps") },
    { href: "/#faq", label: t("faq") },
    { href: "/docs", label: t("docs") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2.5 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrandLogo size={26} priority variant="wordmark" />
          <span className="leading-none">
            <span className="mt-1 block text-[0.65rem] tracking-wide text-muted-foreground">
              {tBrand("tagline")}
            </span>
          </span>
        </Link>

        <nav
          aria-label={t("ariaLabel")}
          className="ml-auto hidden items-center gap-1 xl:flex"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 xl:ml-2">
          <LocaleSwitcher compact className="hidden sm:inline-flex" />
          {user ? (
            <Link
              href="/dashboard"
              prefetch={false}
              aria-label={t("signedInAs", { name: sessionDisplayName(user) })}
              className="hidden min-w-0 items-center rounded-lg px-2 py-1 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex"
            >
              <MarketingSignedInChip
                user={user}
                caption={t("signedIn")}
                className="inline-flex max-w-44 min-w-0 items-center gap-2"
              />
            </Link>
          ) : (
            <Button
              variant="ghost"
              className="hidden sm:inline-flex"
              render={<Link href="/sign-in" />}
            >
              {t("signIn")}
            </Button>
          )}
          <Button render={<Link href="/dashboard" prefetch={false} />}>
            {user ? t("continueToApp") : t("openApp")}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
          <details className="group relative xl:hidden">
            <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md border border-input outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <MenuIcon className="size-4" aria-hidden="true" />
              <span className="sr-only">{t("openMenu")}</span>
            </summary>
            <nav
              aria-label={t("ariaLabel")}
              className="absolute top-11 right-0 z-50 w-64 space-y-1 rounded-xl border bg-popover p-2 text-popover-foreground shadow-xl"
            >
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  {item.label}
                </Link>
              ))}
              <div className="my-2 border-t" />
              {user ? (
                <Link
                  href="/dashboard"
                  prefetch={false}
                  aria-label={t("signedInAs", {
                    name: sessionDisplayName(user),
                  })}
                  className="flex items-center rounded-lg px-3 py-2 hover:bg-muted"
                >
                  <MarketingSignedInChip user={user} caption={t("signedIn")} />
                </Link>
              ) : (
                <Link
                  href="/sign-in"
                  className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  {t("signIn")}
                </Link>
              )}
              <LocaleSwitcher
                align="start"
                size="sm"
                className="mt-1 w-full justify-start"
              />
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
