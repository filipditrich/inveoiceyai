import { config as loadDotEnv } from "dotenv";
import { withEve } from "eve/next";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
