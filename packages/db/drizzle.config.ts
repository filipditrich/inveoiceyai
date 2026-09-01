import { defineConfig } from "drizzle-kit";
import { resolve } from "path";

import { loadRepoEnv } from "@invoicey/env/load";

/** drizzle-kit runs with cwd `packages/db`, so root `.env` is not automatic. */
const repoRoot = loadRepoEnv();

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
