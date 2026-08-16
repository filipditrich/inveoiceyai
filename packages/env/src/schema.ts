import { z } from "zod";

/**
 * Matches `NODE_ENV` at runtime (`development`, `production`, `test`).
 */
export const APP_ENV = {
  DEVELOPMENT: "development",
  PRODUCTION: "production",
  TEST: "test",
} as const;

export type AppEnv = (typeof APP_ENV)[keyof typeof APP_ENV];

const NODE_ENV_VALUES = [
  APP_ENV.DEVELOPMENT,
  APP_ENV.PRODUCTION,
  APP_ENV.TEST,
] as const;

/** Deployment intent for banners and toggles (`NEXT_PUBLIC_APP_STAGE`). */
export const APP_STAGE = {
  DEVELOPMENT: "development",
  PRODUCTION: "production",
  STAGING: "staging",
  BETA: "beta",
  ALPHA: "alpha",
} as const;

export type AppStage = (typeof APP_STAGE)[keyof typeof APP_STAGE];

const APP_STAGE_VALUES = [
  APP_STAGE.DEVELOPMENT,
  APP_STAGE.PRODUCTION,
  APP_STAGE.STAGING,
  APP_STAGE.BETA,
  APP_STAGE.ALPHA,
] as const;

/** Public env vars (safe on the client — only `NEXT_PUBLIC_*` whitelist in `env.config.client.ts`). */
export const publicEnvSchema = z.object({
  NODE_ENV: z.enum(NODE_ENV_VALUES),
  /** Public origin (SPAYD, links, callbacks). */
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_APP_STAGE: z
    .enum(APP_STAGE_VALUES)
    .default(APP_STAGE.DEVELOPMENT),
});

/** Normalize missing / blank `.env` values to `undefined` for optional fields. */
function emptyEnvToUndefined(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return value;
  const t = value.trim();
  return t === "" ? undefined : t;
}

/** Server-only / secret env vars. */
export const privateEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1)),
  DATABASE_URL_UNPOOLED: z.preprocess(
    emptyEnvToUndefined,
    z.string().min(1).optional(),
  ),
  /** Default workspace until auth (multi-tenant schema). Optional until callers require it. */
  INVOICEY_DEFAULT_WORKSPACE_ID: z.preprocess(
    emptyEnvToUndefined,
    z.uuid().optional(),
  ),
  /**
   * Comma-separated emails promoted to platform admin on session create (ADR 0024).
   * Promote-only — never auto-demotes.
   */
  INVOICEY_PLATFORM_ADMIN_EMAILS: z.preprocess(
    emptyEnvToUndefined,
    z.string().min(1).optional(),
  ),
  UPLOADTHING_TOKEN: z.preprocess(emptyEnvToUndefined, z.string().optional()),
  UPLOADTHING_APP_ID: z.preprocess(emptyEnvToUndefined, z.string().optional()),
  /**
   * Legacy bearer gate for `/api/mcp`. Optional: the route fails closed when
   * unset, so the app boots without it. Removed once MCP moves to OAuth (Plan 14).
   */
  MCP_API_KEY: z.preprocess(emptyEnvToUndefined, z.string().min(1).optional()),

  /**
   * Better Auth (Plan 14). Optional here so the app still boots mid-migration;
   * tightened to required once sign-in is the only way in.
   * `BETTER_AUTH_URL` falls back to `NEXT_PUBLIC_APP_URL` when unset.
   */
  BETTER_AUTH_SECRET: z.preprocess(
    emptyEnvToUndefined,
    z.string().min(32).optional(),
  ),
  BETTER_AUTH_URL: z.preprocess(emptyEnvToUndefined, z.url().optional()),
  GOOGLE_CLIENT_ID: z.preprocess(emptyEnvToUndefined, z.string().optional()),
  GOOGLE_CLIENT_SECRET: z.preprocess(
    emptyEnvToUndefined,
    z.string().optional(),
  ),
  GITHUB_CLIENT_ID: z.preprocess(emptyEnvToUndefined, z.string().optional()),
  GITHUB_CLIENT_SECRET: z.preprocess(
    emptyEnvToUndefined,
    z.string().optional(),
  ),

  /**
   * Resend (Plan 11). Optional so the app boots without mail configured;
   * send / webhook fail closed when unset.
   */
  RESEND_API_KEY: z.preprocess(
    emptyEnvToUndefined,
    z.string().min(1).optional(),
  ),
  RESEND_WEBHOOK_SECRET: z.preprocess(
    emptyEnvToUndefined,
    z.string().min(1).optional(),
  ),
  EMAIL_FROM: z.preprocess(emptyEnvToUndefined, z.string().min(1).optional()),
  /** Invites + security; default `Invoicey <noreply@invoicey.ditrich.me>`. */
  EMAIL_SYSTEM_FROM: z.preprocess(
    emptyEnvToUndefined,
    z.string().min(1).optional(),
  ),
  /** Bearer for `/api/cron/overdue-reminders` and `/api/cron/recurring-drafts`. */
  CRON_SECRET: z.preprocess(emptyEnvToUndefined, z.string().min(1).optional()),
  /**
   * Base64-encoded 32-byte AES key used only for bank access tokens. Keep old
   * versions available during rotation; Plan 22 starts with version 1.
   */
  BANK_TOKEN_ENCRYPTION_KEY_V1: z.preprocess(
    emptyEnvToUndefined,
    z.string().min(1).optional(),
  ),
  BANK_TOKEN_ACTIVE_KEY_VERSION: z.preprocess(
    emptyEnvToUndefined,
    z.coerce.number().int().positive().default(1),
  ),
  /**
   * Resend Inbound receiving domain (Plan 24b), e.g. inbox.invoicey.ditrich.me.
   */
  INVOICEY_INBOUND_EMAIL_DOMAIN: z.preprocess(
    emptyEnvToUndefined,
    z.string().min(1).optional(),
  ),
  /** Svix secret for the email.received webhook. Distinct from delivery events. */
  RESEND_INBOUND_WEBHOOK_SECRET: z.preprocess(
    emptyEnvToUndefined,
    z.string().min(1).optional(),
  ),
  INVOICEY_INBOUND_MAX_ATTACHMENT_BYTES: z.preprocess(
    emptyEnvToUndefined,
    z.coerce.number().int().positive().default(20_971_520),
  ),
  INVOICEY_INBOUND_MAX_MESSAGES_PER_DAY: z.preprocess(
    emptyEnvToUndefined,
    z.coerce.number().int().positive().default(200),
  ),
  /** Document-capable AI Gateway model for incoming-invoice extraction (Plan 24c). */
  INVOICEY_AI_EXTRACT_MODEL: z.preprocess(
    emptyEnvToUndefined,
    z.string().min(1).optional(),
  ),
  /**
   * Shared secret for the agent/bot login page. Unset disables the route.
   * Does not reintroduce product password auth (ADR 0018).
   */
  INVOICEY_AGENT_LOGIN_SECRET: z.preprocess(
    emptyEnvToUndefined,
    z.string().min(16).optional(),
  ),
});

/** Vercel-only system vars (subset). @see https://vercel.com/docs/environment-variables/system-environment-variables */
export const vercelEnvSchema = z.object({
  VERCEL: z.enum(["1"]).optional(),
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
  VERCEL_URL: z.string().optional(),
  VERCEL_BRANCH_URL: z.string().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  VERCEL_REGION: z.string().optional(),
  VERCEL_DEPLOYMENT_ID: z.string().optional(),
  VERCEL_PROJECT_ID: z.string().optional(),
  /** Full git SHA of the deployment commit (Vercel system env). */
  VERCEL_GIT_COMMIT_SHA: z.string().optional(),
  NEXT_RUNTIME: z.enum(["nodejs", "edge"]).optional(),
  npm_package_version: z.string().optional(),
});

export const fullEnvSchema = vercelEnvSchema
  .merge(publicEnvSchema)
  .merge(privateEnvSchema);

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type PrivateEnv = z.infer<typeof privateEnvSchema>;
export type VercelEnv = z.infer<typeof vercelEnvSchema>;
export type FullEnv = z.infer<typeof fullEnvSchema>;
