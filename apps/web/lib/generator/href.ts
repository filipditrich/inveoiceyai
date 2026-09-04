import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from "@/i18n/config";

/** Cookie locale, falling back to Czech. */
export function appLocaleFrom(value: string): AppLocale {
  return isAppLocale(value) ? value : DEFAULT_LOCALE;
}

export const GENERATOR_PATH_CS = "/faktura-zdarma";
export const GENERATOR_PATH_EN = "/free-invoice-generator";

/** Locale-specific public generator URL. Both routes share one form. */
export function generatorPathForLocale(locale: AppLocale): string {
  return locale === "en" ? GENERATOR_PATH_EN : GENERATOR_PATH_CS;
}
