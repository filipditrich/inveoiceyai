import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE } from "./config";

/**
 * Single-locale (cs) request config — Czech-only MVP (ADR 0012).
 * No `[locale]` URL segment; bilingual routing can land post-MVP.
 */
export default getRequestConfig(async () => {
  const messages = (await import(`../locales/${DEFAULT_LOCALE}.json`)).default;

  return {
    locale: DEFAULT_LOCALE,
    messages,
  };
});
