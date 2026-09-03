import { BrandLogo } from "@/components/brand-logo";
import { AppleLogo } from "@/components/marketing/apple-logo";
import { CompetitorComparison } from "@/components/marketing/competitor-comparison";
import { DownloadMenu } from "@/components/marketing/download-menu";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { InstallCommand } from "@/components/marketing/install-command";
import {
  CLI_INSTALL_COMMAND,
  macDownloadUrl,
} from "@/components/marketing/mac-download";
import { MARKETING_PILL_LG_CLASS } from "@/components/marketing/marketing-cta";
import motionStyles from "@/components/marketing/marketing-motion.module.css";
import { MarketingSignedInChip } from "@/components/marketing/marketing-signed-in";
import { NfctronLogo } from "@/components/marketing/nfctron-logo";
import { PricingPlans } from "@/components/marketing/pricing-plans";
import { ProductDemo } from "@/components/marketing/product-demo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { env } from "@/env.config.server";
import { getOptionalSession } from "@/lib/auth/session";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BotIcon,
  Building2Icon,
  CalendarSyncIcon,
  CheckCircle2Icon,
  CoinsIcon,
  DatabaseIcon,
  FileArchiveIcon,
  FileCheck2Icon,
  HardDriveIcon,
  KeyRoundIcon,
  LibraryIcon,
  LandmarkIcon,
  MailCheckIcon,
  MessageSquareTextIcon,
  QrCodeIcon,
  SearchCheckIcon,
  SendIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SquareTerminalIcon,
  WalletIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Marketing.meta");
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: "/" },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "/",
    },
  };
}

export default async function HomePage() {
  const t = await getTranslations("Marketing");
  const tDownload = await getTranslations("Marketing.download");
  const user = await getOptionalSession();
  const macUrl = macDownloadUrl(env.INVOICEY_DRIVE_DMG_URL);
  const downloadLabels = {
    cli: tDownload("cli"),
    cliHint: tDownload("cliHint"),
    label: tDownload("label"),
    mac: tDownload("mac"),
    macHint: tDownload("macHint"),
    requirements: tDownload("requirements"),
    trigger: tDownload("trigger"),
  };
  const trustItems = [
    { icon: FileCheck2Icon, label: t("trust.pdfIsdoc") },
    { icon: QrCodeIcon, label: t("trust.spaydQr") },
    { icon: SearchCheckIcon, label: t("trust.aresLookup") },
    { icon: LandmarkIcon, label: t("trust.bankSync") },
    { icon: CalendarSyncIcon, label: t("trust.recurring") },
    { icon: Building2Icon, label: t("trust.multiIssuer") },
  ];
  const capabilities = [
    {
      icon: FileCheck2Icon,
      title: t("capabilities.docsTitle"),
      description: t("capabilities.docsDescription"),
    },
    {
      icon: Building2Icon,
      title: t("capabilities.issuersTitle"),
      description: t("capabilities.issuersDescription"),
    },
    {
      icon: MailCheckIcon,
      title: t("capabilities.emailTitle"),
      description: t("capabilities.emailDescription"),
    },
    {
      icon: WalletIcon,
      title: t("capabilities.paymentsTitle"),
      description: t("capabilities.paymentsDescription"),
    },
    {
      icon: CalendarSyncIcon,
      title: t("capabilities.recurringTitle"),
      description: t("capabilities.recurringDescription"),
    },
    {
      icon: CoinsIcon,
      title: t("capabilities.currencyTitle"),
      description: t("capabilities.currencyDescription"),
    },
    {
      icon: FileArchiveIcon,
      title: t("capabilities.historyTitle"),
      description: t("capabilities.historyDescription"),
    },
    {
      icon: DatabaseIcon,
      title: t("capabilities.schemaTitle"),
      description: t("capabilities.schemaDescription"),
    },
    {
      icon: ShieldCheckIcon,
      title: t("capabilities.securityTitle"),
      description: t("capabilities.securityDescription"),
    },
  ];
  const paymentItems = [
    t("payments.item1"),
    t("payments.item2"),
    t("payments.item3"),
    t("payments.item4"),
  ];
  const automationItems = [
    t("automation.item1"),
    t("automation.item2"),
    t("automation.item3"),
    t("automation.item4"),
  ];
  const integrations = [
    {
      icon: MessageSquareTextIcon,
      title: t("integrations.slackTitle"),
      description: t("integrations.slackDescription"),
      href: "/docs/integrations/slack",
    },
    {
      icon: BotIcon,
      title: t("integrations.mcpTitle"),
      description: t("integrations.mcpDescription"),
      href: "/docs/integrations/mcp",
    },
    {
      icon: LandmarkIcon,
      title: t("integrations.banksTitle"),
      description: t("integrations.banksDescription"),
      href: "/docs/integrations/bank-connections",
    },
    {
      icon: SearchCheckIcon,
      title: t("integrations.aresTitle"),
      description: t("integrations.aresDescription"),
      href: "/docs/guides/clients",
    },
    {
      icon: MailCheckIcon,
      title: t("integrations.emailTitle"),
      description: t("integrations.emailDescription"),
      href: "/docs/guides/sending-email",
    },
    {
      icon: KeyRoundIcon,
      title: t("integrations.apiTitle"),
      description: t("integrations.apiDescription"),
      href: "/docs/integrations/api-keys",
    },
    {
      icon: HardDriveIcon,
      title: t("integrations.driveTitle"),
      description: t("integrations.driveDescription"),
      href: "/docs/integrations/invoicey-drive",
    },
  ];
  const faq = [
    { question: t("faq.q1"), answer: t("faq.a1") },
    { question: t("faq.q2"), answer: t("faq.a2") },
    { question: t("faq.q6"), answer: t("faq.a6") },
    { question: t("faq.q7"), answer: t("faq.a7") },
    { question: t("faq.q8"), answer: t("faq.a8") },
    { question: t("faq.q3"), answer: t("faq.a3") },
    { question: t("faq.q4"), answer: t("faq.a4") },
    { question: t("faq.q5"), answer: t("faq.a5") },
  ];
  return (
    <>
      <section className="relative overflow-hidden border-b">
        <div className="marketing-grid absolute inset-0 -z-20 opacity-55" />
        <div className="absolute -top-48 left-1/2 -z-10 size-[38rem] -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
        <div className="mx-auto max-w-7xl px-4 pt-14 pb-16 sm:px-6 sm:pt-20 lg:px-8">
          <div
            className={`${motionStyles.heroCopy} mx-auto flex max-w-3xl flex-col items-center text-center`}
          >
            <Link
              href="/#apps"
              className="group inline-flex items-center gap-2.5 rounded-full border bg-background/70 py-1 pr-1.5 pl-1.5 text-sm backdrop-blur transition-colors outline-none hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[0.65rem] font-semibold tracking-[0.12em] text-primary uppercase">
                {t("hero.badgeTag")}
              </span>
              <span className="inline-flex items-center">
                <span className="font-medium">{t("hero.badgeTitle")}</span>
                <span
                  aria-hidden="true"
                  className="mx-2.5 hidden size-1 rounded-full bg-muted-foreground sm:inline-block"
                />
                <span className="hidden text-muted-foreground sm:inline">
                  {t("hero.badgeAction")}
                </span>
              </span>
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <ArrowUpRightIcon className="size-3.5" />
              </span>
            </Link>

            <h1 className="mt-8 text-5xl leading-[0.98] font-semibold tracking-[-0.055em] text-balance sm:text-6xl lg:text-[4.5rem]">
              {t("hero.titleLine1")}
              <span className="block text-primary">{t("hero.titleLine2")}</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl">
              {t("hero.subtitle")}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className={`h-11 text-[0.95rem] shadow-lg shadow-primary/15 ${MARKETING_PILL_LG_CLASS}`}
                render={<Link href="/dashboard" prefetch={false} />}
              >
                {user ? t("hero.ctaPrimarySignedIn") : t("hero.ctaPrimary")}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
              <DownloadMenu
                className={`h-11 text-[0.95rem] ${MARKETING_PILL_LG_CLASS}`}
                labels={downloadLabels}
                macDownloadUrl={macUrl}
              />
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2Icon className="size-3.5 text-primary" />
                {t("hero.noPassword")}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2Icon className="size-3.5 text-primary" />
                {t("hero.czechUi")}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2Icon className="size-3.5 text-primary" />
                {t("hero.bankMatching")}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2Icon className="size-3.5 text-primary" />
                {t("hero.betaAccess")}
              </span>
            </div>

            <div className="mt-12 flex items-center gap-3 text-muted-foreground">
              <span className="text-[0.7rem] leading-none tracking-[0.08em] uppercase">
                {t("hero.backedBy")}
              </span>
              <span aria-hidden="true" className="h-3 w-px bg-foreground/20" />
              <a
                href="https://www.nfctron.com"
                rel="noreferrer"
                target="_blank"
                aria-label="NFCtron"
                className="inline-flex items-center leading-none transition-opacity outline-none hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <NfctronLogo className="h-3.5" />
              </a>
            </div>
          </div>

          <div className={`${motionStyles.heroDemo} mt-16 sm:mt-20`}>
            <ProductDemo />
          </div>
        </div>
      </section>

      <section
        aria-label={t("trust.ariaLabel")}
        className="border-b bg-muted/25"
      >
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 sm:px-6 md:grid-cols-3 lg:grid-cols-6 lg:px-8">
          {trustItems.map((item) => (
            <div
              key={item.label}
              className={`${motionStyles.trustItem} flex items-center justify-center gap-2.5 border-x border-transparent px-3 py-5 text-center text-sm font-medium md:border-border/60`}
            >
              <item.icon className="size-4 shrink-0 text-primary" />
              {item.label}
            </div>
          ))}
        </div>
      </section>

      <section
        id="jak-to-funguje"
        className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow={t("workflow.eyebrow")}
            title={t("workflow.title")}
            description={t("workflow.description")}
          />
          <div
            className={`${motionStyles.scrollReveal} mt-14 grid gap-5 lg:grid-cols-3`}
          >
            <WorkflowStep
              number="01"
              icon={<SearchCheckIcon />}
              title={t("workflow.step1Title")}
              description={t("workflow.step1Description")}
            />
            <WorkflowStep
              number="02"
              icon={<FileCheck2Icon />}
              title={t("workflow.step2Title")}
              description={t("workflow.step2Description")}
            />
            <WorkflowStep
              number="03"
              icon={<SendIcon />}
              title={t("workflow.step3Title")}
              description={t("workflow.step3Description")}
            />
          </div>
        </div>
      </section>

      <section
        id="apps"
        className="scroll-mt-24 border-y bg-muted/25 px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow={t("companions.eyebrow")}
            title={t("companions.title")}
            description={t("companions.description")}
          />
          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            <article
              className={`${motionStyles.liftCard} relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#101012] p-7 text-white shadow-2xl shadow-black/20 sm:p-10`}
            >
              <div className="absolute -top-28 -right-20 size-72 rounded-full bg-brand/20 blur-3xl" />
              <div className="relative flex items-start justify-between gap-5">
                <Image
                  alt=""
                  aria-hidden="true"
                  className="size-16 rounded-2xl shadow-xl sm:size-20"
                  height={80}
                  src="/brand/invoicey-app-icon.svg"
                  width={80}
                />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-400">
                  <AppleLogo className="size-3" />
                  macOS 14+
                </span>
              </div>
              <div className="relative mt-12 max-w-xl">
                <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                  {t("companions.macLabel")}
                </p>
                <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                  {t("companions.macTitle")}
                </h3>
                <p className="mt-4 leading-relaxed text-zinc-400">
                  {t("companions.macDescription")}
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <a
                    href={macUrl}
                    className="inline-flex h-12 items-center gap-2.5 rounded-full bg-[#f5f5f4] px-6 text-sm font-medium text-[#0b0b0c] shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <AppleLogo className="size-4" />
                    {t("companions.macDownload")}
                  </a>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-full border-white/15 bg-transparent px-5 text-white hover:bg-white/5 hover:text-white"
                    render={<Link href="/docs/integrations/invoicey-drive" />}
                  >
                    {t("companions.learnMore")}
                  </Button>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-zinc-400">
                  {t("companions.macRequirements")}
                </p>
              </div>
            </article>

            <article
              className={`${motionStyles.liftCard} overflow-hidden rounded-[2rem] border border-white/10 bg-[#101012] p-7 text-white shadow-2xl shadow-black/20 sm:p-10`}
            >
              <div className="flex items-center justify-between gap-5">
                <BrandLogo size={30} tone="on-dark" variant="wordmark" />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-400">
                  <SquareTerminalIcon className="size-3.5" /> CLI
                </span>
              </div>
              <div className="mt-12">
                <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                  {t("companions.cliLabel")}
                </p>
                <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                  {t("companions.cliTitle")}
                </h3>
                <p className="mt-4 max-w-xl leading-relaxed text-zinc-400">
                  {t("companions.cliDescription")}
                </p>
                <div className="mt-8">
                  <InstallCommand
                    command={CLI_INSTALL_COMMAND}
                    copiedLabel={t("companions.copied")}
                    copyLabel={t("companions.copy")}
                  />
                </div>
                <p className="mt-4 text-xs leading-relaxed text-zinc-400">
                  {t("companions.cliRequirements")}
                </p>
                <Link
                  href="/docs/integrations/cli"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-zinc-300 underline decoration-zinc-600 underline-offset-8 transition-colors hover:text-white"
                >
                  {t("companions.cliDocs")}
                  <ArrowRightIcon className="size-4" />
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section
        id="prehled"
        className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow={t("capabilities.eyebrow")}
            title={t("capabilities.title")}
            description={t("capabilities.description")}
          />
          <div
            className={`${motionStyles.scrollReveal} mt-14 grid gap-px overflow-hidden rounded-3xl border bg-border md:grid-cols-2 lg:grid-cols-3`}
          >
            {capabilities.map((capability) => (
              <div
                key={capability.title}
                className={`${motionStyles.liftCard} bg-background p-6 sm:p-8`}
              >
                <span className="grid size-10 place-items-center rounded-xl bg-brand/12">
                  <capability.icon className="size-4.5" />
                </span>
                <h3 className="mt-6 text-lg font-semibold tracking-tight">
                  {capability.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {capability.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="platby"
        className="scroll-mt-24 overflow-hidden border-y bg-muted/25 px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <PaymentLedgerCard />

          <div className={`${motionStyles.scrollReveal} lg:order-first`}>
            <Badge variant="secondary" className="h-7 gap-1.5 px-3">
              <LandmarkIcon data-icon="inline-start" /> {t("payments.badge")}
            </Badge>
            <p className="mt-6 text-sm font-semibold tracking-wide text-primary uppercase">
              {t("payments.eyebrow")}
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">
              {t("payments.title")}
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              {t("payments.description")}
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {paymentItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section
        id="automatizace"
        className="scroll-mt-24 overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div
            className={`${motionStyles.scrollReveal} ${motionStyles.chatStage} relative overflow-hidden rounded-[2rem] bg-foreground p-4 text-background shadow-2xl sm:p-6 dark:bg-card dark:text-card-foreground`}
          >
            <div className="absolute -top-20 -right-20 size-64 rounded-full bg-brand/20 blur-3xl" />
            <div className="relative rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm dark:border-border dark:bg-background/50">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4 dark:border-border">
                <BrandLogo size={36} className="rounded-xl" />
                <div>
                  <p className="text-sm font-medium">
                    {t("automation.chatTitle")}
                  </p>
                  <p className="text-xs text-background/55 dark:text-muted-foreground">
                    {t("automation.chatSubtitle")}
                  </p>
                </div>
              </div>
              <div className="space-y-4 py-5">
                <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-white/10 px-4 py-3 text-sm leading-relaxed dark:bg-muted">
                  {t("automation.chatUserMessage")}
                </div>
                <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-brand px-4 py-3 text-sm text-brand-foreground shadow-lg">
                  <p className="font-medium">
                    {t("automation.chatReplyTitle")}
                  </p>
                  <div className="mt-3 space-y-2 rounded-xl bg-black/8 p-3 text-xs">
                    <ChatRow
                      label={t("automation.chatClientLabel")}
                      value={t("automation.chatClient")}
                    />
                    <ChatRow
                      label={t("automation.chatAmountLabel")}
                      value={t("automation.chatAmount")}
                    />
                    <ChatRow
                      label={t("automation.chatOutputLabel")}
                      value={t("automation.chatOutput")}
                    />
                  </div>
                  <div className="mt-3 inline-flex rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background">
                    {t("automation.chatAction")}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-white/10 pt-4 text-[0.65rem] text-background/75 dark:border-border dark:text-muted-foreground">
                <LandmarkIcon className="size-3.5" />
                {t("automation.chatDisclaimer")}
              </div>
            </div>
          </div>

          <div className={motionStyles.scrollReveal}>
            <Badge variant="secondary" className="h-7 gap-1.5 px-3">
              <BotIcon data-icon="inline-start" /> {t("automation.badge")}
            </Badge>
            <p className="mt-6 text-sm font-semibold tracking-wide text-primary uppercase">
              {t("automation.eyebrow")}
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">
              {t("automation.title")}
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              {t("automation.description")}
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {automationItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section
        id="napojeni"
        className="scroll-mt-24 border-y bg-muted/25 px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow={t("integrations.eyebrow")}
            title={t("integrations.title")}
            description={t("integrations.description")}
          />
          <div
            className={`${motionStyles.scrollReveal} mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4`}
          >
            {integrations.map((integration) => (
              <Link
                key={integration.title}
                href={integration.href}
                className={`${motionStyles.liftCard} group rounded-2xl border bg-card p-6 shadow-xs transition-colors outline-none hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand/12">
                    <integration.icon className="size-4.5" />
                  </span>
                  <ArrowUpRightIcon className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                </div>
                <h3 className="mt-5 text-base font-semibold tracking-tight">
                  {integration.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {integration.description}
                </p>
              </Link>
            ))}
            <Link
              href="/docs"
              className={`${motionStyles.liftCard} group rounded-2xl border border-dashed bg-card/60 p-6 shadow-xs transition-colors outline-none hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-brand/12">
                  <LibraryIcon className="size-4.5" />
                </span>
                <ArrowUpRightIcon className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
              </div>
              <h3 className="mt-5 text-base font-semibold tracking-tight">
                {t("integrations.docsCta")}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t("integrations.docsDescription")}
              </p>
            </Link>
          </div>
        </div>
      </section>

      <section
        id="srovnani"
        className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className={`${motionStyles.scrollReveal} mx-auto max-w-7xl`}>
          <SectionIntro
            eyebrow={t("comparison.eyebrow")}
            title={t("comparison.title")}
            description={t("comparison.description")}
          />
          <CompetitorComparison />
        </div>
      </section>

      <section
        id="cenik"
        className="scroll-mt-24 border-y bg-muted/25 px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className={`${motionStyles.scrollReveal} mx-auto max-w-7xl`}>
          <SectionIntro
            eyebrow={t("pricing.eyebrow")}
            title={t("pricing.title")}
            description={t("pricing.description")}
          />
          <PricingPlans signedIn={user != null} />
        </div>
      </section>

      <section
        id="faq"
        className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.7fr_1fr] lg:gap-20">
          <SectionIntro
            eyebrow={t("faq.eyebrow")}
            title={t("faq.title")}
            description={t("faq.description")}
            align="left"
          />
          <div className={motionStyles.scrollReveal}>
            <FaqAccordion items={faq} />
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
        <div
          className={`${motionStyles.scrollReveal} relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#101012] px-8 py-14 text-center text-white sm:px-12 sm:py-20`}
        >
          <div className="marketing-grid absolute inset-0 opacity-25" />
          <div className="absolute -top-32 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-brand/25 blur-3xl" />
          <div className="relative mx-auto max-w-2xl">
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">
              {t("cta.eyebrow")}
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">
              {t("cta.title")}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-zinc-400 sm:text-lg">
              {user ? t("cta.descriptionSignedIn") : t("cta.description")}
            </p>
            {user ? (
              <div className="mt-7 flex justify-center">
                <MarketingSignedInChip
                  user={user}
                  caption={t("nav.signedIn")}
                />
              </div>
            ) : null}
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                className={`h-11 text-[0.95rem] ${MARKETING_PILL_LG_CLASS}`}
                render={<Link href="/dashboard" prefetch={false} />}
              >
                {user ? t("cta.buttonSignedIn") : t("cta.button")}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className={`h-11 border-white/15 bg-transparent text-[0.95rem] text-white hover:bg-white/5 hover:text-white ${MARKETING_PILL_LG_CLASS}`}
                render={<Link href="/docs" />}
              >
                {t("cta.secondaryButton")}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** Bank credit → match proposal, the shape the payment ledger actually works in. */
async function PaymentLedgerCard() {
  const t = await getTranslations("Marketing.payments");

  return (
    <div
      className={`${motionStyles.scrollReveal} ${motionStyles.chatStage} relative overflow-hidden rounded-[2rem] border bg-card p-4 shadow-2xl sm:p-6`}
    >
      <div className="absolute -top-24 -left-24 size-64 rounded-full bg-brand/15 blur-3xl" />

      <div className="relative rounded-2xl border bg-background p-5">
        <div className="flex items-center gap-3 border-b pb-4">
          <span className="grid size-9 place-items-center rounded-xl bg-muted">
            <LandmarkIcon className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium">{t("cardTitle")}</p>
            <p className="text-xs text-muted-foreground">{t("cardSubtitle")}</p>
          </div>
        </div>
        <div className="mt-4 space-y-2.5 text-sm">
          <LedgerRow label={t("creditAmountLabel")} value={t("creditAmount")} />
          <LedgerRow label={t("creditVsLabel")} value={t("creditVs")} mono />
          <LedgerRow label={t("creditDateLabel")} value={t("creditDate")} />
        </div>
      </div>

      <div className="relative flex justify-center py-3">
        <span className="grid size-8 place-items-center rounded-full bg-brand text-brand-foreground shadow-lg">
          <ArrowDownIcon className="size-4" />
        </span>
      </div>

      <div className="relative rounded-2xl border border-primary/30 bg-brand/10 p-5">
        <p className="flex items-center gap-2 text-sm font-medium">
          <SparklesIcon className="size-4 text-primary" />
          {t("matchTitle")}
        </p>
        <div className="mt-4 space-y-2.5 text-sm">
          <LedgerRow label={t("matchInvoiceLabel")} value={t("matchInvoice")} />
          <LedgerRow label={t("matchStateLabel")} value={t("matchState")} />
        </div>
        <div className="mt-4 inline-flex rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background">
          {t("matchAction")}
        </div>
      </div>

      <p className="relative mt-4 flex items-center gap-2 text-[0.65rem] text-muted-foreground">
        <ShieldCheckIcon className="size-3.5" />
        {t("disclaimer")}
      </p>
    </div>
  );
}

function LedgerRow({
  label,
  mono = false,
  value,
}: Readonly<{ label: string; mono?: boolean; value: string }>) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`text-right text-sm font-medium ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function SectionIntro({
  align = "center",
  description,
  eyebrow,
  title,
}: Readonly<{
  align?: "center" | "left";
  description: string;
  eyebrow: string;
  title: string;
}>) {
  return (
    <div
      className={`${motionStyles.scrollReveal} ${
        align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-xl"
      }`}
    >
      <p className="text-sm font-semibold tracking-wide text-primary uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl">
        {title}
      </h2>
      <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
        {description}
      </p>
    </div>
  );
}

function WorkflowStep({
  description,
  icon,
  number,
  title,
}: Readonly<{
  description: string;
  icon: React.ReactNode;
  number: string;
  title: string;
}>) {
  return (
    <div
      className={`${motionStyles.liftCard} relative rounded-3xl border bg-card p-6 shadow-xs sm:p-8`}
    >
      <span className="absolute top-6 right-7 font-mono text-4xl font-semibold tracking-tighter text-muted-foreground/75">
        {number}
      </span>
      <span className="grid size-11 place-items-center rounded-2xl bg-brand/12 [&_svg]:size-5">
        {icon}
      </span>
      <h3 className="mt-8 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function ChatRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
