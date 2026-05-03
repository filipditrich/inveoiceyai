import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

/** Repo root — drizzle-kit runs with cwd `packages/db`, so Bun/Next root `.env` is not loaded automatically */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

loadEnv({ path: resolve(repoRoot, ".env") });
loadEnv({ path: resolve(repoRoot, ".env.local"), override: true });

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error(
    `DATABASE_URL is empty. Set it in ${resolve(repoRoot, ".env")} or ${resolve(repoRoot, ".env.local")} at the monorepo root, then run bun db:push again.`,
  );
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
