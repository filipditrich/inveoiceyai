import { LegalDocument } from "@/components/marketing/legal-document";
import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Marketing.legal.privacy");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/privacy" },
  };
}

export default async function PrivacyPage() {
  const t = await getTranslations("Marketing.legal.privacy");
  const s1Items = t("s1Items")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
  const s2Items = t("s2Items")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <LegalDocument
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
    >
      <aside>{t("betaNotice")}</aside>
      <h2>{t("s1Title")}</h2>
      <p>{t("s1Intro")}</p>
      <ul>
        {s1Items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h2>{t("s2Title")}</h2>
      <p>{t("s2Intro")}</p>
      <ul>
        {s2Items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
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
    </LegalDocument>
  );
}
