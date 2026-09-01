import { LegalDocument } from "@/components/marketing/legal-document";
import { Button } from "@/components/ui/button";
import { C15tSettingsLink } from "@/features/c15t";
import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Marketing.legal.cookies");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/cookies" },
  };
}

export default async function CookiesPage() {
  const t = await getTranslations("Marketing.legal.cookies");
  return (
    <LegalDocument
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
    >
      <div className="not-prose mb-10 rounded-2xl border bg-card p-5 shadow-xs">
        <p className="text-sm font-medium">{t("changeChoiceTitle")}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {t("changeChoiceDescription")}
        </p>
        <Button className="mt-4" nativeButton render={<C15tSettingsLink />}>
          {t("changeChoiceButton")}
        </Button>
      </div>
      <h2>{t("s1Title")}</h2>
      <p>{t("s1Body")}</p>
      <h2>{t("s2Title")}</h2>
      <p>{t("s2Body")}</p>
      <h2>{t("s3Title")}</h2>
      <p>{t("s3Body")}</p>
      <h2>{t("s4Title")}</h2>
      <p>{t("s4Body")}</p>
    </LegalDocument>
  );
}
