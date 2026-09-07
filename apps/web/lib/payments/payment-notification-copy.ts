import type { EmailLocale } from "@invoicey/emails";
import type { MatchConfidence } from "@invoicey/payment-core";

/**
 * Match vocabulary for surfaces that cannot reach next-intl.
 *
 * `/payments` renders these codes through `messages.Payments.*`, but email
 * templates and Slack cards are built outside a request's i18n context. The
 * wording is kept deliberately identical to `locales/{en,cs}.json` so a
 * proposal reads the same in the digest as it does on the page.
 */

/** `exact` is a presentation tier, not a matcher confidence — see `confidenceKey`. */
type ConfidenceKey = MatchConfidence | "exact";

const CONFIDENCE_LABELS = {
  cs: {
    exact: "Přesná shoda",
    high: "Silná shoda",
    medium: "Pravděpodobná shoda",
    low: "Vyžaduje pozornou kontrolu",
  },
  en: {
    exact: "Exact match",
    high: "Strong match",
    medium: "Likely match",
    low: "Needs a careful review",
  },
} satisfies Record<EmailLocale, Record<ConfidenceKey, string>>;

const BLOCKER_LABELS = new Map<string, Record<EmailLocale, string>>([
  [
    "ambiguous_variable_symbol",
    {
      cs: "Variabilní symbol odpovídá více než jedné faktuře",
      en: "Variable symbol matches more than one invoice",
    },
  ],
]);

/**
 * Sync error codes come from `normalizeFioError` and its Moneta twin, which are
 * free to grow. A `Map` keeps that open set honest instead of pretending the
 * lookup is total.
 */
const SYNC_ERROR_LABELS = new Map<string, Record<EmailLocale, string>>([
  [
    "fio_unauthorized",
    {
      cs: "Banka token odmítla — pravděpodobně vypršel",
      en: "The bank rejected the token — it has most likely expired",
    },
  ],
  [
    "fio_forbidden",
    {
      cs: "Token nemá právo Sledování účtu",
      en: "The token lacks the account-monitoring right",
    },
  ],
  [
    "fio_rate_limited",
    {
      cs: "Banka dočasně omezila počet dotazů",
      en: "The bank temporarily throttled requests",
    },
  ],
  [
    "fio_account_changed",
    {
      cs: "Token nyní ukazuje na jiný účet",
      en: "The token now points at a different account",
    },
  ],
  [
    "moneta_unauthorized",
    {
      cs: "Banka token odmítla — pravděpodobně vypršel",
      en: "The bank rejected the token — it has most likely expired",
    },
  ],
  [
    "moneta_forbidden",
    {
      cs: "Token nemá potřebné oprávnění",
      en: "The token lacks the required permission",
    },
  ],
  [
    "bank_account_not_found",
    {
      cs: "K připojení chybí bankovní účet",
      en: "The connection has no bank account attached",
    },
  ],
]);

const PROVIDER_LABELS = new Map<string, string>([
  ["fio", "Fio banka"],
  ["moneta", "MONETA Money Bank"],
]);

/**
 * Mirrors `matchLabel` on `/payments`, including its exact-match special case.
 *
 * `confidence` arrives as a bare column value, so an unrecognised tier reads as
 * the most cautious one rather than blank.
 */
function confidenceKey(proposal: {
  score: number;
  confidence: string;
  reasons: readonly string[];
  blockers: readonly string[];
}): ConfidenceKey {
  if (
    proposal.score === 100 &&
    proposal.confidence === "high" &&
    proposal.blockers.length === 0 &&
    proposal.reasons.includes("exact_variable_symbol") &&
    proposal.reasons.includes("exact_outstanding_amount")
  ) {
    return "exact";
  }
  if (proposal.confidence === "high") return "high";
  if (proposal.confidence === "medium") return "medium";
  return "low";
}

export function confidenceLabel(
  locale: EmailLocale,
  proposal: {
    score: number;
    confidence: string;
    reasons: readonly string[];
    blockers: readonly string[];
  },
): string {
  return CONFIDENCE_LABELS[locale][confidenceKey(proposal)];
}

export function blockerLabels(
  locale: EmailLocale,
  blockers: readonly string[],
): string[] {
  return blockers.map(
    (blocker) => BLOCKER_LABELS.get(blocker)?.[locale] ?? blocker,
  );
}

/** Falls back to the raw code: an unmapped error is still better than silence. */
export function syncErrorLabel(locale: EmailLocale, code: string): string {
  return SYNC_ERROR_LABELS.get(code)?.[locale] ?? code;
}

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS.get(provider) ?? provider;
}
