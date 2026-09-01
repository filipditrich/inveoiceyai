"use client";

import { useEffect } from "react";
import {
  productAnalyticsBrowserEventName,
  trackProductEvent,
  type ProductEventName,
  type ProductAnalyticsProperties,
} from "@/lib/product-analytics";
import { useConsentManager } from "@c15t/react";
import { track } from "@vercel/analytics";
import { Analytics } from "@vercel/analytics/next";

/** Do not request the analytics script until measurement consent is active. */
export function ConsentAwareAnalytics() {
  const consent = useConsentManager();

  // c15t hydrates this map after the provider first renders even though its
  // public type declares it as always present.
  if (!consent.consents?.measurement) {
    return null;
  }

  return <MeasuredAnalytics />;
}

function MeasuredAnalytics() {
  useEffect(() => {
    const onProductEvent = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          name: ProductEventName;
          properties: ProductAnalyticsProperties;
        }>
      ).detail;
      if (!detail) return;
      trackProductEvent(
        { track: (name, properties) => track(name, properties) },
        true,
        detail.name,
        detail.properties,
      );
    };
    window.addEventListener(productAnalyticsBrowserEventName(), onProductEvent);
    return () =>
      window.removeEventListener(
        productAnalyticsBrowserEventName(),
        onProductEvent,
      );
  }, []);

  return <Analytics />;
}
