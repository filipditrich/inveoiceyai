import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { C15tSettingsLink } from "@/features/c15t";
import { appLocaleFrom, generatorPathForLocale } from "@/lib/generator/href";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { NfctronLogo } from "./nfctron-logo";

export async function MarketingFooter() {
  const t = await getTranslations("Marketing.footer");
  const tNav = await getTranslations("Marketing.nav");
  const tHero = await getTranslations("Marketing.hero");
  const locale = appLocaleFrom(await getLocale());
  const generatorHref = generatorPathForLocale(locale);

  return (
    <footer className="border-t bg-muted/25">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between lg:px-8">
        <div className="max-w-md">
          {/* In dark mode the visible lockup is aria-hidden, so name the link. */}
          <Link
            href="/"
            aria-label="Invoicey"
            className="inline-flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <BrandLogo size={28} variant="wordmark" />
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {t("description")}
          </p>
          <p className="mt-4 inline-flex items-center gap-2 text-xs leading-none text-muted-foreground">
            <span className="leading-none">{tHero("backedBy")}</span>
            <a
              href="https://www.nfctron.com"
              rel="noreferrer"
              target="_blank"
              aria-label="NFCtron"
              className="inline-flex items-center leading-none transition-opacity hover:opacity-80"
            >
              <NfctronLogo className="h-[13px]" />
            </a>
          </p>
        </div>

        <div className="space-y-4 md:text-right">
          <nav
            aria-label={t("legalNav")}
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground md:justify-end"
          >
            <Link
              className="transition-colors hover:text-foreground"
              href={generatorHref}
            >
              {tNav("generator")}
            </Link>
            <Link
              className="transition-colors hover:text-foreground"
              href="/docs"
            >
              {t("docs")}
            </Link>
            <Link
              className="transition-colors hover:text-foreground"
              href="/brand"
            >
              {t("brand")}
            </Link>
            <Link
              className="transition-colors hover:text-foreground"
              href="/privacy"
            >
              {t("privacy")}
            </Link>
            <Link
              className="transition-colors hover:text-foreground"
              href="/terms"
            >
              {t("terms")}
            </Link>
            <Link
              className="transition-colors hover:text-foreground"
              href="/cookies"
            >
              {t("cookies")}
            </Link>
            <C15tSettingsLink className="transition-colors hover:text-foreground">
              {t("cookieSettings")}
            </C15tSettingsLink>
          </nav>
          {/* Appearance and language live here only — the header stays a nav bar. */}
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <LocaleSwitcher size="sm" />
            <ThemeToggle />
            <p className="text-xs text-muted-foreground md:ml-2">
              {t("copyright", { year: String(new Date().getFullYear()) })}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
