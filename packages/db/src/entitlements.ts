import { z } from "zod";

/**
 * Entitlements are the *only* thing that decides what a workspace may do
 * (ADR 0035). Nothing in the app branches on a plan key: a plan is a row whose
 * `entitlements` blob is resolved against the workspace's overrides, so a new
 * commercial package — including a bespoke one for a single customer — is data,
 * not a deploy.
 *
 * `null` means unlimited wherever a limit is nullable. It is deliberately not
 * `Infinity` (does not survive JSON) or `-1` (invites arithmetic bugs).
 */

/**
 * A one-time token award declared by the plan and applied at most once per
 * workspace (ADR 0037). `key` is the idempotency identifier — changing it on a
 * live plan re-grants to every workspace already on that plan, so treat it as
 * immutable once published.
 */
export const TokenGrantRuleSchema = z.object({
  key: z.string().min(1),
  trigger: z.enum(["signup", "first_invoice_issued"]),
  tokens: z.number().int().positive(),
  bucket: z.literal("gifted"),
  notify: z.boolean(),
});

export type TokenGrantRule = z.infer<typeof TokenGrantRuleSchema>;

export const EntitlementsSchema = z.object({
  /** Workspace members, including the owner. `null` = unlimited. */
  seats: z.object({ max: z.number().int().positive().nullable() }),
  /** Issuer businesses the workspace may invoice from. `null` = unlimited. */
  issuers: z.object({ max: z.number().int().positive().nullable() }),
  ai: z.object({
    /** Seeds `ai_token_balances.monthly_limit` on assignment and renewal. */
    monthlyIncludedTokens: z.number().int().nonnegative(),
    /** Surfaces the top-up UI. Stubbed until a payment path exists. */
    topUpEnabled: z.boolean(),
    grants: z.array(TokenGrantRuleSchema),
  }),
  clients: z.object({
    /**
     * `managed` restricts the workspace to the plan's client catalog: no
     * create, edit, or delete on any surface (ADR 0036).
     */
    createMode: z.enum(["open", "managed"]),
  }),
  permissions: z.object({
    /**
     * `off` hides the surface and treats every member as their role preset;
     * `roles` exposes presets; `advanced` adds per-member overrides (ADR 0038).
     */
    mode: z.enum(["off", "roles", "advanced"]),
  }),
  features: z.object({
    bankConnections: z.boolean(),
    recurring: z.boolean(),
    historicalImport: z.boolean(),
    /** Slack, MCP, and Eve as one switch — they meter against the same tokens. */
    agents: z.boolean(),
  }),
  looks: z.object({
    /**
     * `classic` may apply only Classic. `catalog` may apply every first-party
     * look (Minimal today; community later).
     */
    apply: z.enum(["classic", "catalog"]),
  }),
  auth: z.object({
    /** Empty = any address. Gates both plan auto-assignment and invitations. */
    allowedEmailDomains: z.array(z.string()),
  }),
  audit: z.object({
    /** `null` = keep forever. */
    retentionDays: z.number().int().positive().nullable(),
  }),
});

export type Entitlements = z.infer<typeof EntitlementsSchema>;

/** Recursive partial — the shape `workspaces.entitlement_overrides` holds. */
export type EntitlementOverrides = {
  [K in keyof Entitlements]?: Partial<Entitlements[K]>;
};

/**
 * The floor every plan is built from. A plan row stores a complete
 * `Entitlements`, but seeds and migrations spread this so that adding a new
 * entitlement does not require rewriting every existing row by hand.
 */
export const BASE_ENTITLEMENTS: Entitlements = {
  seats: { max: 1 },
  issuers: { max: 1 },
  ai: { monthlyIncludedTokens: 100_000, topUpEnabled: true, grants: [] },
  clients: { createMode: "open" },
  permissions: { mode: "off" },
  features: {
    bankConnections: false,
    recurring: true,
    historicalImport: true,
    agents: true,
  },
  looks: { apply: "classic" },
  auth: { allowedEmailDomains: [] },
  audit: { retentionDays: 30 },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Plan defaults, then workspace overrides. Scalars are replaced and **arrays
 * are replaced wholesale, never concatenated** — otherwise an override could
 * only ever widen `allowedEmailDomains`, and shrinking one is the more likely
 * reason to override it at all.
 *
 * The result is parsed, not cast: a plan row hand-edited into an invalid shape
 * fails here rather than silently disabling a gate somewhere downstream.
 */
export function resolveEntitlements(
  planEntitlements: unknown,
  overrides?: unknown,
): Entitlements {
  const base = EntitlementsSchema.parse(planEntitlements);
  if (!isPlainObject(overrides)) {
    return base;
  }

  const merged: Record<string, unknown> = { ...base };
  for (const [section, value] of Object.entries(overrides)) {
    if (!(section in base)) continue;
    const current = merged[section];
    merged[section] =
      isPlainObject(current) && isPlainObject(value)
        ? { ...current, ...value }
        : value;
  }

  return EntitlementsSchema.parse(merged);
}

/** Dot-path into resolved entitlements, for `requireEntitlement()` call sites. */
export type BooleanEntitlementPath =
  | `features.${keyof Entitlements["features"]}`
  | "ai.topUpEnabled";

export function readBooleanEntitlement(
  entitlements: Entitlements,
  path: BooleanEntitlementPath,
): boolean {
  if (path === "ai.topUpEnabled") return entitlements.ai.topUpEnabled;
  const key = path.slice("features.".length) as keyof Entitlements["features"];
  return entitlements.features[key];
}

/**
 * `true` when a limit still has room. `null` (unlimited) always has room; a
 * limit of 0 never does.
 */
export function hasQuotaRoom(max: number | null, used: number): boolean {
  return max === null || used < max;
}
