import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  FileCheck2Icon,
  QrCodeIcon,
  SearchCheckIcon,
} from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";

export async function AuthShell({
  children,
}: Readonly<{ children: ReactNode }>) {
  const t = await getTranslations("Auth.shell");
  const tFooter = await getTranslations("Marketing.footer");

  return (
    <main className="grid min-h-svh lg:grid-cols-[1.05fr_0.95fr]">
      <section className="bg-foreground text-background dark:bg-card dark:text-card-foreground relative hidden min-h-svh overflow-hidden p-10 lg:flex lg:flex-col">
        <div className="bg-brand/30 absolute -left-28 -top-36 size-[30rem] rounded-full blur-3xl" />
        <div className="bg-primary/20 absolute bottom-[-12rem] right-[-10rem] size-[32rem] rounded-full blur-3xl" />
        <div className="marketing-grid absolute inset-0 opacity-10" />

        <Link
          href="/"
          className="focus-visible:ring-3 relative inline-flex w-fit items-center gap-3 rounded-xl outline-none focus-visible:ring-white/35"
        >
          <BrandLogo size={40} priority className="ring-white/15" />
          <span>
            <span className="block text-lg font-semibold tracking-tight">
              Invoicey
            </span>
            <span className="text-background/50 dark:text-muted-foreground block text-xs">
              {t("tagline")}
            </span>
          </span>
        </Link>

        <div className="relative my-auto max-w-xl py-16">
          <p className="text-brand text-sm font-semibold uppercase tracking-wide">
            {t("eyebrow")}
          </p>
          <h1 className="mt-5 text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.05em]">
            {t("title")}
          </h1>
          <p className="text-background/60 dark:text-muted-foreground mt-6 max-w-lg text-lg leading-relaxed">
            {t("description")}
          </p>

          <div className="mt-10 grid grid-cols-3 gap-3">
            <AuthFeature icon={<SearchCheckIcon />} label="ARES" />
            <AuthFeature icon={<FileCheck2Icon />} label="PDF + ISDOC" />
            <AuthFeature icon={<QrCodeIcon />} label="QR" />
          </div>
        </div>

        <div className="text-background/45 dark:text-muted-foreground relative flex items-center gap-2 text-xs">
          <CheckCircle2Icon className="size-3.5" />
          {t("oauthNote")}
        </div>
      </section>

      <section className="bg-background flex min-h-svh flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-5 sm:px-8">
          <Link
            href="/"
            className="focus-visible:ring-3 focus-visible:ring-ring/50 flex items-center gap-2.5 rounded-xl outline-none lg:hidden"
          >
            <BrandLogo size={34} priority />
            <span className="font-semibold tracking-tight">Invoicey</span>
          </Link>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link
              href="/"
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 items-center justify-center gap-1.5 rounded-md text-sm transition-colors sm:w-auto sm:px-2.5"
              title={t("backHome")}
            >
              <ArrowLeftIcon className="size-3.5" />
              <span className="sr-only sm:not-sr-only">{t("backHome")}</span>
            </Link>
            <LocaleSwitcher compact className="sm:hidden" />
            <LocaleSwitcher size="sm" className="hidden sm:inline-flex" />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </div>

        <nav className="text-muted-foreground flex flex-wrap justify-center gap-x-5 gap-y-2 px-5 py-6 text-xs">
          <Link
            href="/privacy"
            className="hover:text-foreground transition-colors"
          >
            {tFooter("privacy")}
          </Link>
          <Link
            href="/terms"
            className="hover:text-foreground transition-colors"
          >
            {tFooter("terms")}
          </Link>
          <Link
            href="/cookies"
            className="hover:text-foreground transition-colors"
          >
            {tFooter("cookies")}
          </Link>
        </nav>
      </section>
    </main>
  );
}

function AuthFeature({
  icon,
  label,
}: Readonly<{ icon: ReactNode; label: string }>) {
  return (
    <div className="dark:border-border dark:bg-background/50 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <span className="text-brand [&_svg]:size-4">{icon}</span>
      <p className="mt-3 text-xs font-medium">{label}</p>
    </div>
  );
}
