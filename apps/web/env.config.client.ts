import { APP_ENV, APP_STAGE, publicEnvSchema } from "@invoicey/env/schema";
import type { PublicEnv } from "@invoicey/env/schema";

/**
 * Validates only explicitly listed public vars — no server secrets at runtime.
 *
 * IMPORTANT: Keep keys in sync with `publicEnvSchema` in `@invoicey/env/schema`.
 */
function parseClientEnv(): PublicEnv {
  try {
    const nodeEnvRaw = process.env.NODE_ENV;
    /** Bundlers occasionally omit NODE_ENV until define passes; coerce for Zod enum. */
    const nodeEnv =
      nodeEnvRaw === APP_ENV.PRODUCTION ||
      nodeEnvRaw === APP_ENV.TEST ||
      nodeEnvRaw === APP_ENV.DEVELOPMENT
        ? nodeEnvRaw
        : APP_ENV.DEVELOPMENT;

    const clientEnvVars = {
      NODE_ENV: nodeEnv,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_APP_STAGE: process.env.NEXT_PUBLIC_APP_STAGE,
    } as const satisfies Record<keyof PublicEnv, string | undefined>;

    return publicEnvSchema.parse(clientEnvVars);
  } catch (error) {
    console.error("[invoicey/env] Client environment validation failed:");
    if (error instanceof Error) console.error(error.message);
    console.error(
      "Set required NEXT_PUBLIC_* vars (see `.env.example` at repo root).",
    );
    throw error;
  }
}

/** Validated client env — immutable. */
export const env = Object.freeze(parseClientEnv());

export const IS_PRODUCTION_STAGE =
  env.NEXT_PUBLIC_APP_STAGE === APP_STAGE.PRODUCTION;
export const IS_DEVELOPMENT_STAGE =
  env.NEXT_PUBLIC_APP_STAGE === APP_STAGE.DEVELOPMENT ||
  env.NEXT_PUBLIC_APP_STAGE === undefined;
export const IS_STAGING = env.NEXT_PUBLIC_APP_STAGE === APP_STAGE.STAGING;
export const IS_BETA = env.NEXT_PUBLIC_APP_STAGE === APP_STAGE.BETA;
export const IS_ALPHA = env.NEXT_PUBLIC_APP_STAGE === APP_STAGE.ALPHA;
export const IS_LOCAL = env.NODE_ENV === APP_ENV.DEVELOPMENT;
export const IS_LOCAL_DEV = env.NODE_ENV !== APP_ENV.PRODUCTION;
export const IS_DEPLOYED = env.NODE_ENV === APP_ENV.PRODUCTION;
export const CURRENT_APP_STAGE = env.NEXT_PUBLIC_APP_STAGE;

export { APP_ENV, APP_STAGE };
