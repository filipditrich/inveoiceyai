import type { Formats } from "next-intl";

/**
 * Shared next-intl format presets (dates / numbers / currency).
 * Currency code is still passed at call sites (MVP: CZK).
 */
export const appFormats = {
  dateTime: {
    /** Invoice calendar dates (issue / due / DUZP). */
    invoiceDate: {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      timeZone: "UTC",
    },
    short: {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    },
    medium: {
      dateStyle: "medium",
      timeStyle: "short",
    },
  },
  number: {
    precise: {
      maximumFractionDigits: 2,
    },
    compact: {
      notation: "compact",
      maximumFractionDigits: 1,
    },
  },
} satisfies Formats;
