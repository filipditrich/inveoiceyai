import { getTranslations } from "next-intl/server";
import Link from "next/link";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Support");
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: "/support" },
  };
}
export default async function SupportPage() {
  const t = await getTranslations("Support");
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-4 text-lg text-muted-foreground">{t("description")}</p>
      <section className="mt-10 rounded-2xl border p-6">
        <h2 className="text-xl font-semibold">{t("publisher")}</h2>
        <p className="mt-4">Ing. Filip Ditrich</p>
        <a
          className="inline-flex min-h-11 items-center text-primary underline"
          href="mailto:filip@ditrich.me"
        >
          filip@ditrich.me
        </a>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          {t("help")}
        </p>
      </section>
      <Link
        className="mt-6 inline-flex min-h-11 items-center underline"
        href="/docs/integrations/chatgpt"
      >
        {t("chatgpt")}
      </Link>
      <h2 className="mt-8 text-xl font-semibold">{t("privacy")}</h2>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        {t("privacyBody")}
      </p>
    </article>
  );
}
