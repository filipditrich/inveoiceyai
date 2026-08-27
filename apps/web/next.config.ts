import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotEnv } from "dotenv";
import { withBotId } from "botid/next/config";
import { withEve } from "eve/next";
import { createMDX } from "fumadocs-mdx/next";
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
const rootPackage = require("../../package.json") as { version: string };

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
    /** typed message keys from the Czech catalog (source of truth for AppConfig) */
    createMessagesDeclaration: ["./locales/cs.json"],
  },
});

/**
 * Settings moved from one flat list to `/settings/account/*` (you) and
 * `/settings/workspace/*` (this workspace). The old paths are in sent emails,
 * Slack link cards, and bookmarks, so they keep resolving.
 */
const legacySettingsRedirects = [
  ["/settings", "/settings/account"],
  ["/settings/security", "/settings/account/security"],
  ["/settings/referrals", "/settings/account/referrals"],
  ["/settings/members", "/settings/workspace/members"],
  ["/settings/usage", "/settings/workspace/usage"],
  ["/settings/api-keys", "/settings/workspace/api-keys"],
  ["/settings/bank-connections", "/settings/workspace/bank-connections"],
  ["/settings/integrations", "/settings/workspace/integrations"],
] as const;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return legacySettingsRedirects.map(([source, destination]) => ({
      source,
      destination,
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              "frame-ancestors 'none'",
              "form-action 'self' https://accounts.google.com https://github.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "style-src 'self' 'unsafe-inline'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
              "connect-src 'self' https: wss:",
              "frame-src 'self' blob: https:",
            ].join("; "),
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  /** so NFT can follow `../../packages/invoice-core/assets/**` outside apps/web */
  outputFileTracingRoot: repoRoot,
  env: {
    NEXT_PUBLIC_APP_VERSION: rootPackage.version,
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

/**
 * Fumadocs content pipeline for `/docs` (`content/docs/**.mdx`) — registers the
 * MDX + macro loaders (Turbopack rules) and adds `mdx` to `pageExtensions`.
 *
 * Innermost on purpose: `withEve` returns a config *function*, not an object,
 * so it has to stay outermost. `createMDX()` returns a `NextConfig &
 * PromiseLike<NextConfig>` whose `then` is non-enumerable; `withNextIntl`
 * spreads it away. That is fine here — the deferred work is the content-config
 * emit, which only applies to the `source.config.ts` API. We use the macro API,
 * which compiles per-file through the loaders instead.
 */
const withMDX = createMDX();

export default withEve(withBotId(withNextIntl(withMDX(nextConfig))), {
  /** copy invoice-core fonts/xsd into Eve `__server.func` after nitro build */
  eveBuildCommand: "node ./scripts/eve-build-with-assets.mjs",
});
