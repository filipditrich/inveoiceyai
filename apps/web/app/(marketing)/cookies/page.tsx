import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LegalDocument } from "@/components/marketing/legal-document";
import { Button } from "@/components/ui/button";
import { C15tSettingsLink } from "@/features/c15t";

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
      <div className="not-prose bg-card shadow-xs mb-10 rounded-2xl border p-5">
        <p className="text-sm font-medium">{t("changeChoiceTitle")}</p>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          {t("changeChoiceDescription")}
        </p>
        <Button className="mt-4" render={<C15tSettingsLink />}>
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
