import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotEnv } from "dotenv";
import { withEve } from "eve/next";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/** Monorepo root — same `.env` as Drizzle (@invoicey/db); Next only reads `apps/web` by default. */
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

loadDotEnv({ path: path.join(repoRoot, ".env") });
loadDotEnv({ path: path.join(repoRoot, ".env.local"), override: true });

const require = createRequire(import.meta.url);
const webPackage = require("./package.json") as { version: string };

/** Prefer Vercel system SHA; fall back to local git for `bun dev` / local builds. */
function resolveGitCommitSha(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (fromVercel) {
    return fromVercel.slice(0, 7);
  }
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "dev";
  }
}

/** invoice-core fonts/xsd/icc for PDF/ISDOC serverless traces */
const invoiceCoreAssets = [
  "../../packages/invoice-core/assets/fonts/**/*",
  "../../packages/invoice-core/assets/schemas/**/*",
  "../../packages/invoice-core/assets/icc/**/*",
];

const withNextIntl = createNextIntlPlugin({
  requestConfig: "./i18n/request.ts",
  experimental: {
    /** typed message keys from the Czech catalog (ADR 0012) */
    createMessagesDeclaration: ["./locales/cs.json"],
  },
});

const nextConfig: NextConfig = {
  /** so NFT can follow `../../packages/invoice-core/assets/**` outside apps/web */
  outputFileTracingRoot: repoRoot,
  env: {
    NEXT_PUBLIC_APP_VERSION: webPackage.version,
    NEXT_PUBLIC_GIT_COMMIT_SHA: resolveGitCommitSha(),
  },
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
    /** Eve durable tools run here — was missing; caused missing Inter.ttf on create_invoice */
    "/.well-known/workflow/**": invoiceCoreAssets,
  },
};

export default withEve(withNextIntl(nextConfig));
