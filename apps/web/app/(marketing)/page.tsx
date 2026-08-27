import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BotIcon,
  Building2Icon,
  CalendarSyncIcon,
  CheckCircle2Icon,
  CircleDollarSignIcon,
  CoinsIcon,
  DatabaseIcon,
  FileArchiveIcon,
  FileCheck2Icon,
  KeyRoundIcon,
  LandmarkIcon,
  MailCheckIcon,
  MessageSquareTextIcon,
  QrCodeIcon,
  SearchCheckIcon,
  SendIcon,
  ShieldCheckIcon,
  SparklesIcon,
  WalletIcon,
} from "lucide-react";

import { ProductPreview } from "@/components/marketing/product-preview";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import motionStyles from "@/components/marketing/marketing-motion.module.css";
import { MarketingSignedInChip } from "@/components/marketing/marketing-signed-in";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getOptionalSession } from "@/lib/auth/session";

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
  const user = await getOptionalSession();
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
      <section className="relative overflow-hidden">
        <div className="marketing-grid absolute inset-0 -z-20 opacity-55" />
        <div className="bg-brand/20 absolute -top-48 left-1/2 -z-10 size-[38rem] -translate-x-1/2 rounded-full blur-3xl" />
        <div className="mx-auto grid max-w-7xl gap-14 px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16 lg:px-8 lg:pt-28">
          <div className={`${motionStyles.heroCopy} max-w-2xl`}>
            <Badge
              variant="outline"
              className="bg-background/70 h-7 gap-1.5 px-3 backdrop-blur"
            >
              <SparklesIcon data-icon="inline-start" />
              {t("hero.badge")}
            </Badge>
            <h1 className="mt-7 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-[4.5rem]">
              {t("hero.titleLine1")}
              <span className="dark:text-primary block text-[#914522]">
                {t("hero.titleLine2")}
              </span>
            </h1>
            <p className="text-muted-foreground mt-7 max-w-xl text-pretty text-lg leading-relaxed sm:text-xl">
              {t("hero.subtitle")}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="shadow-primary/15 h-11 px-5 text-[0.95rem] shadow-lg"
                render={<Link href="/dashboard" prefetch={false} />}
              >
                {user ? t("hero.ctaPrimarySignedIn") : t("hero.ctaPrimary")}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 px-5 text-[0.95rem]"
                render={<Link href="#jak-to-funguje" />}
              >
                {t("hero.ctaSecondary")}
              </Button>
            </div>
            {user ? (
              <p className="mt-5">
                <MarketingSignedInChip
                  user={user}
                  caption={t("nav.signedIn")}
                />
              </p>
            ) : null}
            <div className="text-muted-foreground mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs">
              <span className="flex items-center gap-1.5">
                <CheckCircle2Icon className="text-primary size-3.5" />
                {t("hero.noPassword")}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2Icon className="text-primary size-3.5" />
                {t("hero.czechUi")}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2Icon className="text-primary size-3.5" />
                {t("hero.bankMatching")}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2Icon className="text-primary size-3.5" />
                {t("hero.betaAccess")}
              </span>
            </div>
          </div>

          <ProductPreview />
        </div>
      </section>

      <section
        aria-label={t("trust.ariaLabel")}
        className="bg-muted/25 border-y"
      >
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 sm:px-6 md:grid-cols-3 lg:grid-cols-6 lg:px-8">
          {trustItems.map((item) => (
            <div
              key={item.label}
              className={`${motionStyles.trustItem} md:border-border/60 flex items-center justify-center gap-2.5 border-x border-transparent px-3 py-5 text-center text-sm font-medium`}
            >
              <item.icon className="text-primary size-4 shrink-0" />
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
        id="prehled"
        className="bg-muted/25 scroll-mt-24 border-y px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow={t("capabilities.eyebrow")}
            title={t("capabilities.title")}
            description={t("capabilities.description")}
          />
          <div
            className={`${motionStyles.scrollReveal} bg-border mt-14 grid gap-px overflow-hidden rounded-3xl border md:grid-cols-2 lg:grid-cols-3`}
          >
            {capabilities.map((capability) => (
              <div
                key={capability.title}
                className={`${motionStyles.liftCard} bg-background p-6 sm:p-8`}
              >
                <span className="bg-brand/12 grid size-10 place-items-center rounded-xl">
                  <capability.icon className="size-4.5" />
                </span>
                <h3 className="mt-6 text-lg font-semibold tracking-tight">
                  {capability.title}
                </h3>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  {capability.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="platby"
        className="scroll-mt-24 overflow-hidden px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <PaymentLedgerCard />

          <div className={`${motionStyles.scrollReveal} lg:order-first`}>
            <Badge variant="secondary" className="h-7 gap-1.5 px-3">
              <LandmarkIcon data-icon="inline-start" /> {t("payments.badge")}
            </Badge>
            <p className="dark:text-primary mt-6 text-sm font-semibold uppercase tracking-wide text-[#914522]">
              {t("payments.eyebrow")}
            </p>
            <h2 className="mt-3 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              {t("payments.title")}
            </h2>
            <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
              {t("payments.description")}
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {paymentItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2Icon className="text-primary mt-0.5 size-4 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section
        id="automatizace"
        className="bg-muted/25 scroll-mt-24 overflow-hidden border-y px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div className={motionStyles.scrollReveal}>
            <Badge variant="secondary" className="h-7 gap-1.5 px-3">
              <BotIcon data-icon="inline-start" /> {t("automation.badge")}
            </Badge>
            <h2 className="mt-6 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              {t("automation.title")}
            </h2>
            <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
              {t("automation.description")}
            </p>
            <ul className="mt-8 space-y-3 text-sm">
              {automationItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2Icon className="text-primary mt-0.5 size-4 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div
            className={`${motionStyles.scrollReveal} ${motionStyles.chatStage} bg-foreground text-background dark:bg-card dark:text-card-foreground relative overflow-hidden rounded-[2rem] p-4 shadow-2xl sm:p-6`}
          >
            <div className="bg-brand/20 absolute -right-20 -top-20 size-64 rounded-full blur-3xl" />
            <div className="dark:border-border dark:bg-background/50 relative rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
              <div className="dark:border-border flex items-center gap-3 border-b border-white/10 pb-4">
                <span className="bg-brand text-brand-foreground grid size-9 place-items-center rounded-xl">
                  <MessageSquareTextIcon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {t("automation.chatTitle")}
                  </p>
                  <p className="text-background/55 dark:text-muted-foreground text-xs">
                    {t("automation.chatSubtitle")}
                  </p>
                </div>
              </div>
              <div className="space-y-4 py-5">
                <div className="dark:bg-muted ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-white/10 px-4 py-3 text-sm leading-relaxed">
                  {t("automation.chatUserMessage")}
                </div>
                <div className="bg-brand text-brand-foreground max-w-[92%] rounded-2xl rounded-bl-md px-4 py-3 text-sm shadow-lg">
                  <p className="font-medium">
                    {t("automation.chatReplyTitle")}
                  </p>
                  <div className="bg-black/8 mt-3 space-y-2 rounded-xl p-3 text-xs">
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
                  <div className="bg-foreground text-background mt-3 inline-flex rounded-lg px-3 py-2 text-xs font-semibold">
                    {t("automation.chatAction")}
                  </div>
                </div>
              </div>
              <div className="text-background/75 dark:border-border dark:text-muted-foreground flex items-center gap-2 border-t border-white/10 pt-4 text-[0.65rem]">
                <LandmarkIcon className="size-3.5" />
                {t("automation.chatDisclaimer")}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="napojeni"
        className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <SectionIntro
            eyebrow={t("integrations.eyebrow")}
            title={t("integrations.title")}
            description={t("integrations.description")}
          />
          <div
            className={`${motionStyles.scrollReveal} mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3`}
          >
            {integrations.map((integration) => (
              <Link
                key={integration.title}
                href={integration.href}
                className={`${motionStyles.liftCard} bg-card shadow-xs hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 group rounded-2xl border p-6 outline-none transition-colors`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="bg-brand/12 grid size-10 place-items-center rounded-xl">
                    <integration.icon className="size-4.5" />
                  </span>
                  <ArrowUpRightIcon className="text-muted-foreground group-hover:text-foreground size-4 transition-colors" />
                </div>
                <h3 className="mt-5 text-base font-semibold tracking-tight">
                  {integration.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {integration.description}
                </p>
              </Link>
            ))}
          </div>
          <div className={`${motionStyles.scrollReveal} mt-8 text-center`}>
            <Button variant="outline" render={<Link href="/docs" />}>
              {t("integrations.docsCta")}
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-muted/25 border-y px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div
          className={`${motionStyles.scrollReveal} mx-auto grid max-w-7xl gap-5 md:grid-cols-2 lg:grid-cols-3`}
        >
          <FeaturePanel
            icon={<Building2Icon />}
            eyebrow={t("featurePanels.multiIssuerEyebrow")}
            title={t("featurePanels.multiIssuerTitle")}
            description={t("featurePanels.multiIssuerDescription")}
            items={[
              t("featurePanels.multiIssuerItem1"),
              t("featurePanels.multiIssuerItem2"),
              t("featurePanels.multiIssuerItem3"),
            ]}
          />
          <FeaturePanel
            icon={<CalendarSyncIcon />}
            eyebrow={t("featurePanels.recurringEyebrow")}
            title={t("featurePanels.recurringTitle")}
            description={t("featurePanels.recurringDescription")}
            items={[
              t("featurePanels.recurringItem1"),
              t("featurePanels.recurringItem2"),
              t("featurePanels.recurringItem3"),
            ]}
          />
          <FeaturePanel
            icon={<FileArchiveIcon />}
            eyebrow={t("featurePanels.importEyebrow")}
            title={t("featurePanels.importTitle")}
            description={t("featurePanels.importDescription")}
            items={[
              t("featurePanels.importItem1"),
              t("featurePanels.importItem2"),
              t("featurePanels.importItem3"),
            ]}
          />
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
          className={`${motionStyles.scrollReveal} from-brand/35 via-brand/15 bg-linear-to-br to-background relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border p-8 sm:p-12 lg:p-16`}
        >
          <CircleDollarSignIcon className="text-primary/15 absolute -bottom-12 -right-8 size-64 -rotate-12" />
          <div className="relative max-w-2xl">
            <p className="dark:text-primary text-sm font-semibold uppercase tracking-wide text-[#914522]">
              {t("cta.eyebrow")}
            </p>
            <h2 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              {t("cta.title")}
            </h2>
            <p className="text-muted-foreground mt-5 text-base leading-relaxed sm:text-lg">
              {user ? t("cta.descriptionSignedIn") : t("cta.description")}
            </p>
            {user ? (
              <div className="mt-6">
                <MarketingSignedInChip
                  user={user}
                  caption={t("nav.signedIn")}
                />
              </div>
            ) : null}
            <Button
              size="lg"
              className="mt-8 h-11 px-5 text-[0.95rem]"
              render={<Link href="/dashboard" prefetch={false} />}
            >
              {user ? t("cta.buttonSignedIn") : t("cta.button")}
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
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
      className={`${motionStyles.scrollReveal} ${motionStyles.chatStage} bg-card relative overflow-hidden rounded-[2rem] border p-4 shadow-2xl sm:p-6`}
    >
      <div className="bg-brand/15 absolute -left-24 -top-24 size-64 rounded-full blur-3xl" />

      <div className="bg-background relative rounded-2xl border p-5">
        <div className="flex items-center gap-3 border-b pb-4">
          <span className="bg-muted grid size-9 place-items-center rounded-xl">
            <LandmarkIcon className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium">{t("cardTitle")}</p>
            <p className="text-muted-foreground text-xs">{t("cardSubtitle")}</p>
          </div>
        </div>
        <div className="mt-4 space-y-2.5 text-sm">
          <LedgerRow label={t("creditAmountLabel")} value={t("creditAmount")} />
          <LedgerRow label={t("creditVsLabel")} value={t("creditVs")} mono />
          <LedgerRow label={t("creditDateLabel")} value={t("creditDate")} />
        </div>
      </div>

      <div className="relative flex justify-center py-3">
        <span className="bg-brand text-brand-foreground grid size-8 place-items-center rounded-full shadow-lg">
          <ArrowDownIcon className="size-4" />
        </span>
      </div>

      <div className="border-primary/30 bg-brand/10 relative rounded-2xl border p-5">
        <p className="flex items-center gap-2 text-sm font-medium">
          <SparklesIcon className="text-primary size-4" />
          {t("matchTitle")}
        </p>
        <div className="mt-4 space-y-2.5 text-sm">
          <LedgerRow label={t("matchInvoiceLabel")} value={t("matchInvoice")} />
          <LedgerRow label={t("matchStateLabel")} value={t("matchState")} />
        </div>
        <div className="bg-foreground text-background mt-4 inline-flex rounded-lg px-3 py-2 text-xs font-semibold">
          {t("matchAction")}
        </div>
      </div>

      <p className="text-muted-foreground relative mt-4 flex items-center gap-2 text-[0.65rem]">
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
      <span className="text-muted-foreground text-xs">{label}</span>
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
      <p className="dark:text-primary text-sm font-semibold uppercase tracking-wide text-[#914522]">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
        {title}
      </h2>
      <p className="text-muted-foreground mt-5 text-base leading-relaxed sm:text-lg">
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
      className={`${motionStyles.liftCard} bg-card shadow-xs relative rounded-3xl border p-6 sm:p-8`}
    >
      <span className="text-muted-foreground/75 absolute right-7 top-6 font-mono text-4xl font-semibold tracking-tighter">
        {number}
      </span>
      <span className="bg-brand/12 grid size-11 place-items-center rounded-2xl [&_svg]:size-5">
        {icon}
      </span>
      <h3 className="mt-8 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
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

function FeaturePanel({
  description,
  eyebrow,
  icon,
  items,
  title,
}: Readonly<{
  description: string;
  eyebrow: string;
  icon: React.ReactNode;
  items: readonly string[];
  title: string;
}>) {
  return (
    <div
      className={`${motionStyles.liftCard} bg-background rounded-[2rem] border p-7 sm:p-10`}
    >
      <span className="bg-brand/12 grid size-11 place-items-center rounded-2xl [&_svg]:size-5">
        {icon}
      </span>
      <p className="dark:text-primary mt-8 text-xs font-semibold uppercase tracking-wide text-[#914522]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-balance text-2xl font-semibold tracking-[-0.035em]">
        {title}
      </h2>
      <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
        {description}
      </p>
      <div className="mt-7 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="bg-muted inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
          >
            <CheckCircle2Icon className="text-primary size-3" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
