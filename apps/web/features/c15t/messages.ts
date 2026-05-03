import type { Translations } from "@c15t/react";

/** Czech copy for banner, dialog, and consent category labels. */
export const invoiceyC15tMessages: Record<string, Partial<Translations>> = {
  cs: {
    common: {
      acceptAll: "Přijmout vše",
      rejectAll: "Odmítnout nepovinné",
      customize: "Přizpůsobit",
      save: "Uložit",
      close: "Zavřít",
    },
    cookieBanner: {
      title: "Cookies a soukromí",
      description:
        "Používáme technologie k provozu služby, zlepšení uživatelské zkušenosti, měření návštěvnosti a případného marketingu. Volbu můžete kdykoliv změnit.",
    },
    consentManagerDialog: {
      title: "Nastavení soukromí",
      description:
        "Vyberte kategorie, se kterými souhlasíte. Nezbytné nelze vypnout.",
    },
    consentTypes: {
      necessary: {
        title: "Nezbytné",
        description:
          "Technologie nutné ke správnému fungování aplikace a zabezpečení.",
      },
      functionality: {
        title: "Funkčnost",
        description:
          "Umožňují rozšířené funkce a personalizaci (např. preference).",
      },
      experience: {
        title: "Zážitek",
        description: "Slouží k vylepšení obsahu a rozhraní na míru.",
      },
      measurement: {
        title: "Měření",
        description: "Pomáhají pochopení návštěvnosti a výkonu služby.",
      },
      marketing: {
        title: "Marketing",
        description:
          "Slouží k zobrazování relevantnějších sdělení (napříč partnery).",
      },
    },
  },
};
