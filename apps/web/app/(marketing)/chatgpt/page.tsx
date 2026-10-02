import { ChatgptShowcase } from "@/components/marketing/chatgpt-showcase";
import { CheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ChatgptSetup");
  return {
    title: t("metaTitle"),
    description: t("description"),
    alternates: { canonical: "/chatgpt" },
  };
}

export default async function ChatgptPage() {
  const t = await getTranslations("ChatgptSetup");
  const steps = [
    { title: t("step1Title"), body: t("step1Body") },
    { title: t("step2Title"), body: t("step2Body") },
    { title: t("step3Title"), body: t("step3Body") },
    { title: t("step4Title"), body: t("step4Body") },
  ];
  return (
    <>
      <ChatgptShowcase setupHref="#setup" />
      <section id="setup" className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-4 text-muted-foreground">{t("description")}</p>
        <aside className="mt-6 rounded-2xl border bg-muted/40 p-5 text-sm leading-relaxed">
          {t("earlyAccess")}
        </aside>
        <ol className="mt-10 space-y-8">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted text-sm font-semibold">
                {index + 1}
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{step.title}</h2>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
                {index === 0 && (
                  <span className="mt-3 inline-flex min-h-11 items-center rounded-full border bg-muted px-5 text-sm text-muted-foreground">
                    {t("installPending")}
                  </span>
                )}
                {index === 3 && (
                  <blockquote className="mt-3 rounded-xl border-l-4 border-primary bg-muted p-4">
                    {t("firstPrompt")}
                  </blockquote>
                )}
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-12 rounded-2xl border p-6">
          <h2 className="text-xl font-semibold">{t("controlTitle")}</h2>
          <p className="mt-3 text-muted-foreground">{t("controlBody")}</p>
          <p className="mt-4 flex gap-2 text-sm">
            <CheckIcon className="size-4 shrink-0 text-primary" />
            {t("disconnect")}
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="font-semibold">{t("duplicateTitle")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("duplicateBody")}
            </p>
          </div>
          <div>
            <h2 className="font-semibold">{t("mobileTitle")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("mobileBody")}
            </p>
          </div>
        </div>
        <Link
          href="/docs/integrations/chatgpt"
          className="mt-8 inline-flex min-h-11 items-center underline"
        >
          {t("guide")}
        </Link>
      </section>
    </>
  );
}
