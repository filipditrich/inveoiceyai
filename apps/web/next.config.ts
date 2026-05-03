import { config as loadDotEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/** Monorepo root — same `.env` as Drizzle (@invoicey/db); Next only reads `apps/web` by default. */
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

loadDotEnv({ path: path.join(repoRoot, ".env") });
loadDotEnv({ path: path.join(repoRoot, ".env.local"), override: true });

const nextConfig: NextConfig = {
  transpilePackages: [
    "@invoicey/ares",
    "@invoicey/db",
    "@invoicey/env",
    "@invoicey/invoice-core",
  ],
};

export default nextConfig;
