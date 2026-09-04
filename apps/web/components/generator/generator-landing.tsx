import { GeneratorForm } from "@/components/generator/generator-form";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { GENERATOR_PATH_CS, GENERATOR_PATH_EN } from "@/lib/generator/href";
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
  const steps = [t("step1"), t("step2"), t("step3")];
  return (
    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
          {t("subtitle")}
        </p>
        <ol className="mt-8 grid gap-3 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li
              className="rounded-xl border bg-card/50 px-4 py-3 text-sm leading-snug"
              key={step}
            >
              <span className="block text-[0.65rem] font-semibold tracking-[0.14em] text-primary uppercase">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="mt-1.5 block text-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </header>
      <div className="pt-10">
        <GeneratorForm />
      </div>
      <section className="mx-auto mt-20 max-w-3xl">
        <h2 className="mb-4 text-2xl font-semibold tracking-[-0.03em]">
          {t("faqTitle")}
        </h2>
        <FaqAccordion
          items={[
            { question: t("faq1Q"), answer: t("faq1A") },
            { question: t("faq2Q"), answer: t("faq2A") },
            { question: t("faq3Q"), answer: t("faq3A") },
          ]}
        />
      </section>
    </div>
  );
}
