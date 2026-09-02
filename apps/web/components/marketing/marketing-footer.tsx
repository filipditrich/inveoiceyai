import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { C15tSettingsLink } from "@/features/c15t";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export async function MarketingFooter() {
  const t = await getTranslations("Marketing.footer");

  return (
    <footer className="border-t bg-muted/25">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between lg:px-8">
        <div className="max-w-md">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <BrandLogo size={28} variant="wordmark" />
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {t("description")}
          </p>
        </div>

        <div className="space-y-3 md:text-right">
          <nav
            aria-label={t("legalNav")}
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground md:justify-end"
          >
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
          <div className="flex items-center gap-3 md:justify-end">
            <LocaleSwitcher size="sm" />
            <p className="text-xs text-muted-foreground">
              {t("copyright", { year: String(new Date().getFullYear()) })}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
