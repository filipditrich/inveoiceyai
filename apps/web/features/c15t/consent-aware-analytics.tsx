"use client";

import { Analytics } from "@vercel/analytics/next";
import { useConsentManager } from "@c15t/react";

/** Do not request the analytics script until measurement consent is active. */
export function ConsentAwareAnalytics() {
  const consent = useConsentManager();

  // c15t hydrates this map after the provider first renders even though its
  // public type declares it as always present.
  if (!consent.consents?.measurement) {
    return null;
  }

  return <Analytics />;
}
