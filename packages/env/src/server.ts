/* eslint-disable no-console */

import type { FullEnv } from "./schema";
import { fullEnvSchema } from "./schema";

/**
 * Validates all env vars once (Neon/Drizzle, Route Handlers, Server Actions).
 * Do not import this module from `"use client"` files.
 */
function parseEnv(): FullEnv {
  try {
    return fullEnvSchema.parse(process.env);
  } catch (error) {
    console.error("[@invoicey/env] Validation failed:", { error });
    if (error instanceof Error) console.error(error.message);
    console.error(
      "Set required variables in repo-root `.env` / `.env.local` (see .env.example).",
    );
    throw error;
  }
}

/** Validated env — immutable. */
export const env = Object.freeze(parseEnv());
