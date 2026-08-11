import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

/**
 * Repo-root `.env` then `.env.local` (local wins).
 *
 * Next.js and Bun only load `.env` relative to the app directory, so anything
 * run from a package — drizzle-kit, one-off scripts — has to do this itself.
 * Importing this module for its side effect is enough:
 *
 *   import "@invoicey/env/load";
 *   import { env } from "@invoicey/env/server";
 *
 * Static imports evaluate in order, so the files are loaded before any module
 * that reads `process.env` at import time.
 */
export function loadRepoEnv(): string {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  loadEnv({ path: resolve(repoRoot, ".env"), quiet: true });
  loadEnv({
    path: resolve(repoRoot, ".env.local"),
    override: true,
    quiet: true,
  });
  return repoRoot;
}

loadRepoEnv();
