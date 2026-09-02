import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  FileCheck2Icon,
  LandmarkIcon,
  SearchCheckIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

export async function AuthShell({
  children,
}: Readonly<{ children: ReactNode }>) {
  const t = await getTranslations("Auth.shell");
  const tFooter = await getTranslations("Marketing.footer");

  const benefits = [
    {
      icon: SearchCheckIcon,
      title: t("benefit1Title"),
      description: t("benefit1Description"),
    },
    {
      icon: FileCheck2Icon,
      title: t("benefit2Title"),
      description: t("benefit2Description"),
    },
    {
      icon: LandmarkIcon,
      title: t("benefit3Title"),
      description: t("benefit3Description"),
    },
  ];

  return (
    <main className="grid min-h-svh lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden min-h-svh overflow-hidden bg-foreground p-10 text-background lg:flex lg:flex-col dark:bg-card dark:text-card-foreground">
        <div className="absolute -top-36 -left-28 size-[30rem] rounded-full bg-brand/30 blur-3xl" />
        <div className="absolute right-[-10rem] bottom-[-12rem] size-[32rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="marketing-grid absolute inset-0 opacity-10" />

        <Link
          href="/"
          className="relative inline-flex w-fit items-center gap-3 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-white/35"
        >
          <BrandLogo size={32} priority tone="on-dark" variant="wordmark" />
          <span>
            <span className="block text-xs text-background/50 dark:text-muted-foreground">
              {t("tagline")}
            </span>
          </span>
        </Link>

        <div className="relative my-auto max-w-xl py-16">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium dark:border-border dark:bg-muted">
            {t("badge")}
          </span>
          <p className="mt-6 text-sm font-semibold tracking-wide text-brand uppercase">
            {t("eyebrow")}
          </p>
          <h2 className="mt-4 text-5xl leading-[1.02] font-semibold tracking-[-0.05em] text-balance">
            {t("title")}
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-background/60 dark:text-muted-foreground">
            {t("description")}
          </p>

          <ul className="mt-10 space-y-3">
            {benefits.map((benefit) => (
              <li
                key={benefit.title}
                className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm dark:border-border dark:bg-background/50"
              >
                <span className="mt-0.5 text-brand [&_svg]:size-4.5">
                  <benefit.icon />
                </span>
                <span>
                  <span className="block text-sm font-medium">
                    {benefit.title}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-background/55 dark:text-muted-foreground">
                    {benefit.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative space-y-2 text-xs text-background/75 dark:text-muted-foreground">
          <p className="flex items-center gap-2">
            <CheckCircle2Icon className="size-3.5 shrink-0" />
            {t("oauthNote")}
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle2Icon className="size-3.5 shrink-0" />
            {t("footerNote")}
          </p>
        </div>
      </section>

      <section className="flex min-h-svh flex-col bg-background">
        <div className="flex items-center justify-between gap-3 px-5 py-5 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
          >
            <BrandLogo size={28} priority variant="wordmark" />
          </Link>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link
              href="/"
              className="inline-flex size-8 items-center justify-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:w-auto sm:px-2.5"
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

        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 px-5 py-6 text-xs text-muted-foreground">
          <Link
            href="/privacy"
            className="transition-colors hover:text-foreground"
          >
            {tFooter("privacy")}
          </Link>
          <Link
            href="/terms"
            className="transition-colors hover:text-foreground"
          >
            {tFooter("terms")}
          </Link>
          <Link
            href="/cookies"
            className="transition-colors hover:text-foreground"
          >
            {tFooter("cookies")}
          </Link>
        </nav>
      </section>
    </main>
  );
}
