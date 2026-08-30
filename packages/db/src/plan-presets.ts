import {
  BASE_ENTITLEMENTS,
  type Entitlements,
  type TokenGrantRule,
} from "./entitlements";

/**
 * Seed data for the launch plan rows (docs/specs/plans-entitlements.md).
 *
 * These are *seeds*, not constants the app reads. Once a row exists, the
 * database is the source of truth and platform admin edits it in `/admin/plans`
 * — re-running the seed only fills in missing rows. That is what keeps a limit
 * change an admin action rather than a deploy (ADR 0035).
 */

/** Reward for issuing the first invoice — the marketed "you're live" moment. */
function firstInvoiceGrant(tokens: number): TokenGrantRule {
  return {
    key: "first_invoice_issued_v1",
    trigger: "first_invoice_issued",
    tokens,
    bucket: "gifted",
    notify: true,
  };
}

function signupGrant(tokens: number): TokenGrantRule {
  return {
    key: "signup_v1",
    trigger: "signup",
    tokens,
    bucket: "gifted",
    notify: false,
  };
}

export interface PlanSeed {
  key: string;
  name: string;
  kind: "builtin" | "custom";
  isDefault: boolean;
  autoAssignEmailDomains: string[];
  entitlements: Entitlements;
}

/**
 * Free is a complete solo Czech invoicing tool — ARES, VAT, ISDOC, QR, PDF,
 * email, recurring, import, and the agent surfaces all work. What it does not
 * get is people, bank reconciliation, or a working AI allowance. Every agent
 * surface already meters against the token balance, so shipping them on Free
 * costs a token budget rather than a feature gate.
 */
const FREE: PlanSeed = {
  key: "free",
  name: "Free",
  kind: "builtin",
  isDefault: true,
  autoAssignEmailDomains: [],
  entitlements: {
    ...BASE_ENTITLEMENTS,
    seats: { max: 1 },
    issuers: { max: 1 },
    ai: {
      monthlyIncludedTokens: 100_000,
      topUpEnabled: true,
      grants: [signupGrant(250_000), firstInvoiceGrant(500_000)],
    },
  },
};

/** Pro adds people and money: seats, permissions, bank reconciliation. */
const PRO: PlanSeed = {
  key: "pro",
  name: "Pro",
  kind: "builtin",
  isDefault: false,
  autoAssignEmailDomains: [],
  entitlements: {
    ...BASE_ENTITLEMENTS,
    seats: { max: 5 },
    issuers: { max: 5 },
    ai: {
      monthlyIncludedTokens: 1_500_000,
      topUpEnabled: true,
      grants: [signupGrant(500_000), firstInvoiceGrant(500_000)],
    },
    permissions: { mode: "advanced" },
    features: { ...BASE_ENTITLEMENTS.features, bankConnections: true },
    audit: { retentionDays: 365 },
  },
};

/** Enterprise adds control: unlimited scale plus the boundary rules. */
const ENTERPRISE: PlanSeed = {
  key: "enterprise",
  name: "Enterprise",
  kind: "builtin",
  isDefault: false,
  autoAssignEmailDomains: [],
  entitlements: {
    ...BASE_ENTITLEMENTS,
    seats: { max: null },
    issuers: { max: null },
    ai: {
      monthlyIncludedTokens: 5_000_000,
      topUpEnabled: true,
      grants: [signupGrant(500_000), firstInvoiceGrant(500_000)],
    },
    permissions: { mode: "advanced" },
    features: { ...BASE_ENTITLEMENTS.features, bankConnections: true },
    audit: { retentionDays: null },
  },
};

/**
 * The first sponsored plan: NFCtron contractors, each in their own isolated
 * workspace issuing from their own IČO, restricted to the NFCtron entities in
 * the plan's client catalog. Pro-shaped but locked — no grants (Invoicey pays
 * for the tokens), no top-up, managed clients, and `nfctron.com` addresses land
 * here automatically on every workspace they create.
 *
 * Seeded with an empty client catalog; the entities are added in `/admin/plans`
 * by IČO so ARES fills the snapshots.
 */
const NFCTRON: PlanSeed = {
  key: "nfctron",
  name: "NFCtron",
  kind: "custom",
  isDefault: false,
  autoAssignEmailDomains: ["nfctron.com"],
  entitlements: {
    ...BASE_ENTITLEMENTS,
    seats: { max: 3 },
    issuers: { max: 1 },
    ai: {
      monthlyIncludedTokens: 1_000_000,
      topUpEnabled: false,
      grants: [],
    },
    clients: { createMode: "managed" },
    permissions: { mode: "roles" },
    features: { ...BASE_ENTITLEMENTS.features, bankConnections: true },
    auth: { allowedEmailDomains: ["nfctron.com"] },
    audit: { retentionDays: 365 },
  },
};

export const PLAN_SEEDS: readonly PlanSeed[] = [
  FREE,
  PRO,
  ENTERPRISE,
  NFCTRON,
] as const;

/** Where a workspace lands with no matching domain rule. */
export const DEFAULT_PLAN_KEY = FREE.key;
