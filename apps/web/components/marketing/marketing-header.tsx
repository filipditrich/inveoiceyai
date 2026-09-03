import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { env } from "@/env.config.server";
import { getOptionalSession } from "@/lib/auth/session";
import { ArrowRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { DownloadMenu } from "./download-menu";
import { macDownloadUrl } from "./mac-download";
import { MarketingMobileNav } from "./marketing-mobile-nav";
import {
  MarketingSignedInChip,
  sessionDisplayName,
} from "./marketing-signed-in";

export async function MarketingHeader() {
  const t = await getTranslations("Marketing.nav");
  const tBrand = await getTranslations("App.brand");
  const tDownload = await getTranslations("Marketing.download");
  const user = await getOptionalSession();

  /** Four destinations, not nine — anything deeper belongs to the page itself. */
  const navItems = [
    { href: "/#jak-to-funguje", label: t("howItWorks") },
    { href: "/#prehled", label: t("capabilities") },
    { href: "/#cenik", label: t("pricing") },
    { href: "/docs", label: t("docs") },
  ];
  /** The sheet has room the header bar does not, so it carries the long tail. */
  const mobileNavItems = [
    ...navItems.slice(0, 2),
    { href: "/#apps", label: t("apps") },
    { href: "/#srovnani", label: t("comparison") },
    ...navItems.slice(2),
    { href: "/#faq", label: t("faq") },
  ];
  const downloadLabels = {
    cli: tDownload("cli"),
    cliHint: tDownload("cliHint"),
    label: tDownload("label"),
    mac: tDownload("mac"),
    macHint: tDownload("macHint"),
    requirements: tDownload("requirements"),
    trigger: tDownload("trigger"),
  };

  const primaryCta = (
    <Button
      className="shrink-0"
      render={<Link href="/dashboard" prefetch={false} />}
    >
      {user ? t("continueToApp") : t("openApp")}
      <ArrowRightIcon data-icon="inline-end" />
    </Button>
  );

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* The tagline is hidden on small screens, so the link needs its own name. */}
        <Link
          href="/"
          aria-label="Invoicey"
          className="flex shrink-0 flex-col items-start gap-0.5 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrandLogo size={24} priority variant="wordmark" />
          <span className="hidden text-[0.6rem] leading-none tracking-[0.12em] text-muted-foreground uppercase sm:block">
            {tBrand("tagline")}
          </span>
        </Link>

        <nav
          aria-label={t("ariaLabel")}
          className="mx-auto hidden items-center gap-1 lg:flex"
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

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <DownloadMenu
            className="hidden lg:inline-flex"
            labels={downloadLabels}
            macDownloadUrl={macDownloadUrl(env.INVOICEY_DRIVE_DMG_URL)}
          />
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
          <span className="hidden sm:inline-flex">{primaryCta}</span>
          <MarketingMobileNav
            items={mobileNavItems}
            labels={{
              description: t("menuDescription"),
              openMenu: t("openMenu"),
              title: t("menuTitle"),
            }}
            actions={
              <>
                {user ? null : (
                  <Button variant="outline" render={<Link href="/sign-in" />}>
                    {t("signIn")}
                  </Button>
                )}
                {primaryCta}
              </>
            }
          />
        </div>
      </div>
    </header>
  );
}
