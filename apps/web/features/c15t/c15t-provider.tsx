"use client";

import type { PropsWithChildren } from "react";
import { C15T_CONSENT_STORAGE_KEY } from "@/features/c15t/constants";
import { invoiceyC15tMessages } from "@/features/c15t/messages";
import { ConsentManagerProvider } from "@c15t/react";
import { serialize } from "cookie";
import { useLocale, useTranslations } from "next-intl";

import type { AppLocale } from "@/i18n/config";

function persistConsentCookie(consents: Record<string, boolean>) {
  if (typeof document === "undefined") return;
  const cookieMaxAgeSec = 60 * 60 * 24 * 365;
  const isProd = process.env.NODE_ENV === "production";
  document.cookie = serialize(
    C15T_CONSENT_STORAGE_KEY,
    JSON.stringify(consents),
    {
      path: "/",
      maxAge: cookieMaxAgeSec,
      sameSite: "strict",
      secure: isProd,
    },
  );
}

/** Offline c15t; mirrors consent to cookie in `onConsentSet`. */
export function C15tProvider({ children }: PropsWithChildren) {
  const locale = useLocale() as AppLocale;
  const tFooter = useTranslations("Marketing.footer");

  return (
    <ConsentManagerProvider
      options={{
        mode: "offline",
        consentCategories: ["necessary", "measurement"],
        legalLinks: {
          privacyPolicy: {
            href: "/privacy",
            target: "_self",
            label: tFooter("privacy"),
          },
          cookiePolicy: {
            href: "/cookies",
            target: "_self",
            label: tFooter("cookies"),
          },
          termsOfService: {
            href: "/terms",
            target: "_self",
            label: tFooter("terms"),
          },
        },
        storageConfig: {
          storageKey: C15T_CONSENT_STORAGE_KEY,
        },
        i18n: {
          locale,
          detectBrowserLanguage: false,
          messages: invoiceyC15tMessages,
        },
        callbacks: {
          onConsentSet({ preferences }) {
            persistConsentCookie(preferences);
          },
        },
      }}
    >
      {children}
    </ConsentManagerProvider>
  );
}
