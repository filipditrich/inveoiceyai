/** UI locales (docs stay English MDX; invoice PDF labels remain Czech — ADR 0012). */
export const DEFAULT_LOCALE = "cs" as const;

export const SUPPORTED_LOCALES = ["cs", "en"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

/** Cookie used when the user picks a language (no URL prefix). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** App-wide calendar/time zone for Czech invoicing dates. */
export const APP_TIME_ZONE = "Europe/Prague";

export function isAppLocale(
  value: string | undefined | null,
): value is AppLocale {
  return (
    value != null && (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

/** Map app locale → BCP 47 tag used by `Intl` / next-intl formatters. */
export function toIntlLocale(locale: AppLocale): string {
  switch (locale) {
    case "cs":
      return "cs-CZ";
    case "en":
      return "en-GB";
    default: {
      const _exhaustive: never = locale;
      return _exhaustive;
    }
  }
}

/** Open Graph `og:locale` values. */
export function toOgLocale(locale: AppLocale): string {
  switch (locale) {
    case "cs":
      return "cs_CZ";
    case "en":
      return "en_GB";
    default: {
      const _exhaustive: never = locale;
      return _exhaustive;
    }
  }
}

/**
 * Pick the best supported locale from an Accept-Language header.
 * Falls back to {@link DEFAULT_LOCALE}.
 */
export function negotiateLocale(acceptLanguage: string | null): AppLocale {
  if (!acceptLanguage) {
    return DEFAULT_LOCALE;
  }
  const candidates = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const quality = q ? Number(q.slice(2)) : 1;
      return {
        tag: tag.toLowerCase(),
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of candidates) {
    if (isAppLocale(tag)) {
      return tag;
    }
    const base = tag.split("-")[0];
    if (isAppLocale(base)) {
      return base;
    }
  }
  return DEFAULT_LOCALE;
}
