import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <MarketingShell>
      <div className="mx-auto flex min-h-[65svh] max-w-3xl flex-col items-center justify-center px-4 py-20 text-center">
        <p className="text-primary font-mono text-sm font-semibold">
          {t("code")}
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-5 max-w-lg leading-relaxed">
          {t("description")}
        </p>
        <Button className="mt-8" render={<Link href="/" />}>
          <ArrowLeftIcon data-icon="inline-start" />
          {t("backButton")}
        </Button>
      </div>
    </MarketingShell>
  );
}
