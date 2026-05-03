"use client";

import { ConsentManagerProvider } from "@c15t/react";
import type { PropsWithChildren } from "react";
import { serialize } from "cookie";

import { C15T_CONSENT_STORAGE_KEY } from "@/features/c15t/constants";
import { invoiceyC15tMessages } from "@/features/c15t/messages";

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
  return (
    <ConsentManagerProvider
      options={{
        mode: "offline",
        consentCategories: [
          "necessary",
          "experience",
          "functionality",
          "marketing",
          "measurement",
        ],
        storageConfig: {
          storageKey: C15T_CONSENT_STORAGE_KEY,
        },
        i18n: {
          locale: "cs",
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
