/** Czech-only MVP locale (ADR 0012). */
export const DEFAULT_LOCALE = "cs" as const;

export const SUPPORTED_LOCALES = [DEFAULT_LOCALE] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
