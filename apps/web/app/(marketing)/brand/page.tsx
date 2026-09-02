import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRightIcon,
  DownloadIcon,
  FileArchiveIcon,
  FileTextIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";

import type { Metadata } from "next";

const DOWNLOADS = {
  kit: "/brand/downloads/invoicey-brand-kit.zip",
  manual: "/brand/downloads/invoicey-brand-guidelines.pdf",
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("BrandPage.meta");
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: "/brand" },
  };
}

export default async function BrandPage() {
  const t = await getTranslations("BrandPage");

  return (
    <div>
      <section className="relative overflow-hidden border-b px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="marketing-grid absolute inset-0 -z-20 opacity-45" />
        <div className="absolute -top-48 left-1/2 -z-10 size-[36rem] -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
        <div className="mx-auto max-w-5xl text-center">
          <Badge variant="outline" className="bg-background/70 backdrop-blur">
            {t("eyebrow")}
          </Badge>
          <div className="mt-10 flex justify-center">
            <BrandLogo size={64} variant="wordmark" />
          </div>
          <h1 className="mx-auto mt-10 max-w-4xl text-5xl leading-[0.98] font-semibold tracking-[-0.055em] text-balance sm:text-6xl">
            {t("title")}
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            {t("description")}
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" render={<a href={DOWNLOADS.kit} download />}>
              <FileArchiveIcon data-icon="inline-start" />
              {t("downloadKit")}
            </Button>
            <Button
              size="lg"
              variant="outline"
              render={<a href={DOWNLOADS.manual} download />}
            >
              <FileTextIcon data-icon="inline-start" />
              {t("downloadManual")}
            </Button>
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">
              {t("systemEyebrow")}
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              {t("systemTitle")}
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              {t("systemDescription")}
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            <AssetCard
              dark
              description={t("wordmarkDescription")}
              downloadLabel={t("downloadSvg")}
              href="/brand/invoicey-lockup.svg"
              title={t("wordmarkTitle")}
            >
              <BrandLogo size={54} tone="on-dark" variant="wordmark" />
            </AssetCard>
            <AssetCard
              description={t("markDescription")}
              downloadLabel={t("downloadSvg")}
              href="/brand/invoicey-app-icon.svg"
              title={t("markTitle")}
            >
              <Image
                alt="Invoicey monogram"
                className="size-28 rounded-[1.75rem] shadow-2xl"
                height={112}
                src="/brand/invoicey-app-icon.svg"
                width={112}
              />
            </AssetCard>
          </div>

          <div className="mt-5 grid gap-px overflow-hidden rounded-3xl border bg-border md:grid-cols-3">
            <Rule
              label={t("ruleWordmarkLabel")}
              value={t("ruleWordmarkValue")}
            />
            <Rule label={t("ruleMarkLabel")} value={t("ruleMarkValue")} />
            <Rule label={t("ruleOrangeLabel")} value={t("ruleOrangeValue")} />
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/25 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">
              {t("usageEyebrow")}
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              {t("usageTitle")}
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              {t("usageDescription")}
            </p>
            <Link
              href="/docs"
              className="mt-7 inline-flex items-center gap-2 text-sm font-medium underline decoration-muted-foreground/50 underline-offset-8"
            >
              {t("docsCta")}
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-[2rem] border bg-[#0b0b0c] p-4 shadow-2xl sm:p-8">
            <Image
              alt={t("socialAlt")}
              className="h-auto w-full rounded-2xl border border-white/10"
              height={630}
              src="/brand/invoicey-social-card.svg"
              width={1200}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function AssetCard({
  children,
  dark = false,
  description,
  downloadLabel,
  href,
  title,
}: Readonly<{
  children: ReactNode;
  dark?: boolean;
  description: string;
  downloadLabel: string;
  href: string;
  title: string;
}>) {
  return (
    <article
      className={`overflow-hidden rounded-[2rem] border ${dark ? "border-white/10 bg-[#101012] text-white" : "bg-card"}`}
    >
      <div className="grid min-h-64 place-items-center p-8">{children}</div>
      <div
        className={`border-t p-6 ${dark ? "border-white/10" : "border-border"}`}
      >
        <div className="flex items-start justify-between gap-5">
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p
              className={`mt-2 text-sm leading-relaxed ${dark ? "text-zinc-400" : "text-muted-foreground"}`}
            >
              {description}
            </p>
          </div>
          <Button
            size="sm"
            variant={dark ? "secondary" : "outline"}
            render={<a href={href} download />}
          >
            <DownloadIcon data-icon="inline-start" />
            {downloadLabel}
          </Button>
        </div>
      </div>
    </article>
  );
}

function Rule({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="bg-background p-6 sm:p-8">
      <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
        {label}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {value}
      </p>
    </div>
  );
}
