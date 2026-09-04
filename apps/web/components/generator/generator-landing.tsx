import { GeneratorForm } from "@/components/generator/generator-form";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import motionStyles from "@/components/marketing/marketing-motion.module.css";
import { GENERATOR_PATH_CS, GENERATOR_PATH_EN } from "@/lib/generator/href";
import { Building2Icon, DownloadIcon, PenLineIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { AppLocale } from "@/i18n/config";
import type { Metadata } from "next";

export async function generatorMetadata(
  canonical: typeof GENERATOR_PATH_CS | typeof GENERATOR_PATH_EN,
  seoLocale: AppLocale,
): Promise<Metadata> {
  const t = await getTranslations({
    locale: seoLocale,
    namespace: "Generator.meta",
  });
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical,
      languages: {
        cs: GENERATOR_PATH_CS,
        en: GENERATOR_PATH_EN,
        "x-default": GENERATOR_PATH_CS,
      },
    },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: canonical,
    },
  };
}

export async function GeneratorLanding() {
  const t = await getTranslations("Generator");
  const steps = [
    { icon: Building2Icon, title: t("step1Title"), body: t("step1Body") },
    { icon: PenLineIcon, title: t("step2Title"), body: t("step2Body") },
    { icon: DownloadIcon, title: t("step3Title"), body: t("step3Body") },
  ];
  return (
    <>
      <section className="relative overflow-hidden border-b">
        <div className="marketing-grid absolute inset-0 -z-20 opacity-50" />
        <div className="absolute -top-36 left-1/3 -z-10 size-[22rem] rounded-full bg-brand/20 blur-3xl" />
        <div className="mx-auto max-w-7xl px-4 pt-12 pb-12 sm:px-6 sm:pt-16 sm:pb-16 lg:px-8">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] text-balance sm:text-5xl lg:text-[3.25rem]">
            {t("title")}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            {t("subtitle")}
          </p>
          <ol className="mt-10 grid gap-4 sm:grid-cols-3">
            {steps.map((step, index) => (
              <li
                className={`${motionStyles.liftCard} relative rounded-2xl border bg-card/70 p-5 shadow-xs`}
                key={step.title}
              >
                <span className="absolute top-5 right-5 font-mono text-2xl font-semibold tracking-tighter text-muted-foreground/70">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="grid size-10 place-items-center rounded-xl bg-brand/12 [&_svg]:size-5">
                  <step.icon />
                </span>
                <h2 className="mt-5 pr-10 text-base font-semibold tracking-tight">
                  {step.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <GeneratorForm />
        <section className="mt-20 border-t pt-16 sm:mt-24 sm:pt-20">
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1fr] lg:gap-16">
            <div className="max-w-md">
              <p className="text-sm font-semibold tracking-wide text-primary uppercase">
                {t("faqEyebrow")}
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                {t("faqTitle")}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t("faqLead")}
              </p>
            </div>
            <FaqAccordion
              items={[
                { question: t("faq1Q"), answer: t("faq1A") },
                { question: t("faq2Q"), answer: t("faq2A") },
                { question: t("faq3Q"), answer: t("faq3A") },
                { question: t("faq4Q"), answer: t("faq4A") },
                { question: t("faq5Q"), answer: t("faq5A") },
                { question: t("faq6Q"), answer: t("faq6A") },
              ]}
            />
          </div>
        </section>
      </div>
    </>
  );
}
