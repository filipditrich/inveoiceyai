import { config as loadDotEnv } from "dotenv";
import { withEve } from "eve/next";
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

/** invoice-core fonts/xsd/icc for PDF/ISDOC serverless traces */
const invoiceCoreAssets = [
  "../../packages/invoice-core/assets/fonts/**/*",
  "../../packages/invoice-core/assets/schemas/**/*",
  "../../packages/invoice-core/assets/icc/**/*",
];

const nextConfig: NextConfig = {
  transpilePackages: [
    "@invoicey/ares",
    "@invoicey/db",
    "@invoicey/env",
    "@invoicey/invoice-core",
    "@invoicey/invoice-tools",
  ],
  outputFileTracingIncludes: {
    "/api/**": invoiceCoreAssets,
    "/eve/**": invoiceCoreAssets,
  },
};

export default withEve(nextConfig);
