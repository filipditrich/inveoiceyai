import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { C15tSettingsLink } from "@/features/c15t";

export async function MarketingFooter() {
  const t = await getTranslations("Marketing.footer");

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
            {t("description")}
          </p>
        </div>

        <div className="space-y-3 md:text-right">
          <nav
            aria-label={t("legalNav")}
            className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 text-sm md:justify-end"
          >
            <Link
              className="hover:text-foreground transition-colors"
              href="/docs"
            >
              {t("docs")}
            </Link>
            <Link
              className="hover:text-foreground transition-colors"
              href="/privacy"
            >
              {t("privacy")}
            </Link>
            <Link
              className="hover:text-foreground transition-colors"
              href="/terms"
            >
              {t("terms")}
            </Link>
            <Link
              className="hover:text-foreground transition-colors"
              href="/cookies"
            >
              {t("cookies")}
            </Link>
            <C15tSettingsLink className="hover:text-foreground transition-colors">
              {t("cookieSettings")}
            </C15tSettingsLink>
          </nav>
          <div className="flex items-center gap-3 md:justify-end">
            <LocaleSwitcher size="sm" />
            <p className="text-muted-foreground text-xs">
              {t("copyright", { year: String(new Date().getFullYear()) })}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
