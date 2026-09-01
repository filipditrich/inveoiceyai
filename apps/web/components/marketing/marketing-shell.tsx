import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import { MarketingFooter } from "./marketing-footer";
import { MarketingHeader } from "./marketing-header";

export async function MarketingShell({
  children,
}: Readonly<{ children: ReactNode }>) {
  const t = await getTranslations("Marketing.nav");
  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#main-content"
        className="fixed top-3 left-3 z-[120] -translate-y-20 rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background transition-transform focus:translate-y-0"
      >
        {t("skipToContent")}
      </a>
      <MarketingHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
