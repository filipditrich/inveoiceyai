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
      title: "Vaše soukromí, vaše volba",
      description:
        "Nezbytné cookies drží Invoicey v chodu. Anonymní měření nám můžete povolit zvlášť. Žádné reklamní cookies.",
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
      measurement: {
        title: "Měření",
        description: "Pomáhají pochopení návštěvnosti a výkonu služby.",
      },
    },
  },
};
