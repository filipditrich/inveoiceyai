import { LegalDocument } from "@/components/marketing/legal-document";
import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Marketing.legal.terms");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/terms" },
  };
}

export default async function TermsPage() {
  const t = await getTranslations("Marketing.legal.terms");
  return (
    <LegalDocument
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
    >
      <aside>{t("betaNotice")}</aside>
      <h2>{t("s1Title")}</h2>
      <p>{t("s1Body")}</p>
      <h2>{t("s2Title")}</h2>
      <p>{t("s2Body")}</p>
      <h2>{t("s3Title")}</h2>
      <p>{t("s3Body")}</p>
      <h2>{t("s4Title")}</h2>
      <p>{t("s4Body")}</p>
      <h2>{t("s5Title")}</h2>
      <p>{t("s5Body")}</p>
      <h2>{t("s6Title")}</h2>
      <p>{t("s6Body")}</p>
      <h2>{t("s7Title")}</h2>
      <p>{t("s7Body")}</p>
      <h2>{t("s8Title")}</h2>
      <p>{t("s8Body")}</p>
      <h2>{t("s9Title")}</h2>
      <p>{t("s9Body")}</p>
    </LegalDocument>
  );
}
