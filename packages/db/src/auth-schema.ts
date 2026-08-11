import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { workspaces } from "./workspaces";

/** Platform-wide role (ADR 0024); orthogonal to workspace owner/admin/member. */
export type PlatformRole = "none" | "admin";

/**
 * Better Auth tables (Plan 14, ADR 0018) for `better-auth@1.6.26`.
 *
 * Column set mirrors `getAuthTables()` of the installed version exactly — it is
 * the source of truth, not the `@better-auth/cli`, which lags the runtime.
 * Re-derive on every `better-auth` upgrade:
 *
 *   bun -e 'const {getAuthTables}=await import("better-auth/db"); …'
 *
 * Export names must match Better Auth model names (`user`, `oauthApplication`,
 * …) because `drizzleAdapter` resolves tables by that key. SQL table names stay
 * plural snake_case to match the rest of the schema — and because `user` is a
 * reserved word in Postgres.
 *
 * There is no `organization` table: that model maps onto `workspaces`
 * (ADR 0019). See `authSchema` at the bottom of this file.
 */

export const user = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** Workspace machine identities fall back to (no active-org cookie). */
  defaultWorkspaceId: text("default_workspace_id"),
  /** Platform ops console (ADR 0024); not a Better Auth organization role. */
  platformRole: text("platform_role")
    .$type<PlatformRole>()
    .notNull()
    .default("none"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const session = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    /** The tenancy id — read by `requireWorkspace()` (ADR 0019). */
    activeOrganizationId: text("active_organization_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const account = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    /** Unused — OAuth only (ADR 0018) — but part of the Better Auth contract. */
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("accounts_user_idx").on(t.userId),
    uniqueIndex("accounts_provider_account_uidx").on(t.providerId, t.accountId),
  ],
);

export const verification = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

/** Workspace membership. `organizationId` -> `workspaces.id` (ADR 0019). */
export const member = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** owner | admin | member */
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("members_org_user_uidx").on(t.organizationId, t.userId),
    index("members_user_idx").on(t.userId),
  ],
);

export const invitation = pgTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    /** pending | accepted | rejected | canceled */
    status: text("status").notNull().default("pending"),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("invitations_org_idx").on(t.organizationId),
    index("invitations_email_idx").on(t.email),
  ],
);

/* ---------------------------------------------------------------------------
 * MCP / OIDC provider (the `mcp` plugin builds on `oidc-provider`).
 * Supports dynamic client registration, which remote MCP clients rely on.
 * ------------------------------------------------------------------------- */

export const oauthApplication = pgTable(
  "oauth_applications",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    icon: text("icon"),
    metadata: text("metadata"),
    clientId: text("client_id").unique(),
    clientSecret: text("client_secret"),
    redirectUrls: text("redirect_urls"),
    type: text("type"),
    disabled: boolean("disabled").default(false),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("oauth_applications_user_idx").on(t.userId)],
);

export const oauthAccessToken = pgTable(
  "oauth_access_tokens",
  {
    id: text("id").primaryKey(),
    accessToken: text("access_token").unique(),
    refreshToken: text("refresh_token").unique(),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    // References `clientId`, not `id` — matches the plugin's own lookups.
    clientId: text("client_id").references(() => oauthApplication.clientId, {
      onDelete: "cascade",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    scopes: text("scopes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("oauth_access_tokens_user_idx").on(t.userId)],
);

export const oauthConsent = pgTable(
  "oauth_consents",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").references(() => oauthApplication.clientId, {
      onDelete: "cascade",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    scopes: text("scopes"),
    consentGiven: boolean("consent_given"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    // Deliberately NOT unique. The plugin re-`create`s a consent row (it never
    // upserts) whenever the request asks for a scope outside the stored consent
    // or sends `prompt=consent`, so a unique (user, client) index would make
    // every re-consent a 500. Upstream has no uniqueness here either.
    index("oauth_consents_user_client_idx").on(t.userId, t.clientId),
  ],
);

/**
 * Personal access tokens (stdio MCP, Eve HTTP).
 * Note `referenceId` — NOT `userId` — is the owning user in 1.6.x.
 * `key` stores the hashed token; the raw value is shown once at creation.
 */
export const apikey = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    configId: text("config_id").notNull().default("default"),
    name: text("name"),
    start: text("start"),
    /** Owning user id. */
    referenceId: text("reference_id").notNull(),
    prefix: text("prefix"),
    key: text("key").notNull(),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at", { withTimezone: true }),
    enabled: boolean("enabled").default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitTimeWindow: integer("rate_limit_time_window").default(86400000),
    rateLimitMax: integer("rate_limit_max").default(10),
    requestCount: integer("request_count").default(0),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    permissions: text("permissions"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("api_keys_reference_idx").on(t.referenceId)],
);

/**
 * Better Auth rate-limit rows when `rateLimit.storage = "database"`.
 * `lastRequest` must be bigint — epoch ms overflows postgres `integer`.
 */
export const rateLimit = pgTable("rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/**
 * Table map handed to `drizzleAdapter`. Keys are Better Auth model names.
 *
 * This is where `organization` becomes `workspaces` (ADR 0019) — the decision
 * the whole tenancy model rests on. It lives here, beside the tables, so every
 * consumer (the web auth server, scripts, a future seed) gets the same mapping
 * instead of re-deriving it and drifting.
 */
export const authSchema = {
  user,
  session,
  account,
  verification,
  organization: workspaces,
  member,
  invitation,
  oauthApplication,
  oauthAccessToken,
  oauthConsent,
  apikey,
  rateLimit,
};
