import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import {
  APP_TIME_ZONE,
  DEFAULT_LOCALE,
  isAppLocale,
  LOCALE_COOKIE,
  negotiateLocale,
  type AppLocale,
} from "./config";
import { appFormats } from "./formats";

async function resolveLocale(): Promise<AppLocale> {
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  if (isAppLocale(fromCookie)) {
    return fromCookie;
  }
  const accept = (await headers()).get("accept-language");
  return negotiateLocale(accept);
}

/**
 * Cookie / Accept-Language locale — no `[locale]` URL segment.
 * Docs MDX stays English regardless of UI locale.
 */
export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = (await import(`../locales/${locale}.json`)).default;

  return {
    locale,
    messages,
    timeZone: APP_TIME_ZONE,
    formats: appFormats,
    now: new Date(),
  };
});
