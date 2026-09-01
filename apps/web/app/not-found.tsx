import { MarketingShell } from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <MarketingShell>
      <div className="mx-auto flex min-h-[65svh] max-w-3xl flex-col items-center justify-center px-4 py-20 text-center">
        <p className="font-mono text-sm font-semibold text-primary">
          {t("code")}
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-5 max-w-lg leading-relaxed text-muted-foreground">
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
