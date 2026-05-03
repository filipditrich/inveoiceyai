"use client";

import { ConsentBanner } from "@c15t/react";

/**
 * First-layer consent banner (c15t v2; styled via `@c15t/react/styles.css` + app tokens).
 */
export function C15tBanner() {
  return <ConsentBanner primaryButton="accept" />;
}
