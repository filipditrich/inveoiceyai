import type { Translations } from "@c15t/react";

/**
 * c15t consent copy for supported UI locales.
 * Kept as a static map (c15t API) — values mirror `Consent.*` in locale catalogs.
 */
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
  en: {
    common: {
      acceptAll: "Accept all",
      rejectAll: "Reject optional",
      customize: "Customize",
      save: "Save",
      close: "Close",
    },
    cookieBanner: {
      title: "Your privacy, your choice",
      description:
        "Essential cookies keep Invoicey running. You can allow anonymous analytics separately. No advertising cookies.",
    },
    consentManagerDialog: {
      title: "Privacy settings",
      description:
        "Choose the categories you agree to. Essential cookies cannot be turned off.",
    },
    consentTypes: {
      necessary: {
        title: "Essential",
        description:
          "Technology required for the app to work correctly and stay secure.",
      },
      measurement: {
        title: "Measurement",
        description: "Help us understand traffic and performance.",
      },
    },
  },
};
