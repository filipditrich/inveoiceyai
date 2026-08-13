# Platform hardening audit — 2026-08-13

## Remediation status

Implemented in the follow-up hardening pass:

- build/type errors repaired; root lint now exits successfully with narrow,
  documented ReUI compiler exceptions;
- trusted, bounded PDF image loading with redirect, MIME/signature, byte,
  timeout, and decoded-dimension checks plus regression tests;
- bounded public demo requests with BotID, rate limiting, collection/body caps,
  concurrency backpressure, and generic failures;
- PR CI for lint, typecheck, unit tests, production build, Better Auth schema
  compatibility, and desktop/mobile Playwright + axe smoke tests;
- baseline response headers and CSP report-only policy;
- immutable issued artifact serving, SHA-256 persistence/verification, safe
  download filenames, and no silent issued-document regeneration;
- generic error UI and persisted workspace fallback;
- docs/auth landmarks and headings, cookie primitive contract, localized
  breadcrumbs, release-version source, bootstrap workspace naming, and durable
  sitemap metadata;
- a maintained [launch-readiness checklist](../launch-readiness.md) for facts and
  operational controls that cannot be safely invented in code.

Still requires an explicit operator action before deployment:

- review and apply the two 2026-08-13 additive SQL files to the intended
  database, then run `bun run --cwd apps/web check:runtime-schema`;
- supply and approve the legal operator/commercial facts in the launch
  checklist;
- make CI required in GitHub branch protection and review CSP telemetry before
  enforcing it.

## Outcome

Invoicey has a strong product surface and several important controls already fail closed, but it is not ready for deeper feature work or an unattended production release in the audited workspace state. The immediate sequence should be:

1. restore a green build and bring the database schema in sync;
2. close the PDF asset-fetch SSRF/resource-exhaustion path;
3. make lint, typecheck, tests, and build mandatory CI gates;
4. harden response headers, error handling, and issued-artifact immutability;
5. add browser-level regression coverage before resuming larger product work.

## Scope and method

Reviewed on 13 August 2026 against the local working tree, which was actively changing during the audit.

- Started `bun dev` with Next.js 16.2.4 and exercised public, authentication, error, workspace-settings, and AI-usage surfaces in the browser.
- Signed in through the configured GitHub OAuth flow and verified authenticated access.
- Probed unauthenticated boundaries for remote MCP, AI invoice drafting, and invoice artifacts.
- Inspected server/browser errors, route handlers, authorization helpers, PDF rendering, artifact serving, metadata, environment validation, and CI workflows.
- Ran root tests, lint, typecheck, and a production build.

The working tree changed concurrently throughout the run. In particular, a default-issuer migration and related code appeared after the server started. Findings tagged **current branch state** may belong to that unfinished work rather than `main`.

## What is already working well

- Public marketing, docs, privacy, terms, cookies, sign-in, invalid-referral, invitation redirect, and Slack-link redirect surfaces rendered without horizontal overflow or obvious unlabeled form controls at the default desktop viewport.
- OAuth sign-in completed correctly and returned to the requested local route.
- Unauthenticated `POST /api/mcp` returned `401` with a Bearer challenge.
- Unauthenticated `POST /api/ai/invoice` returned `401`.
- Unauthenticated invoice PDF access returned `401`.
- Cron handlers explicitly return `503` when `CRON_SECRET` is absent and `401` for an invalid bearer.
- The Resend webhook requires Svix headers and verifies the signature.
- Workspace resolution re-checks membership instead of trusting a stale `activeOrganizationId` blindly.
- Unit tests passed in the final snapshot: web 104, invoice-tools 54, invoice-core 73, email 6, ARES 4, and MCP 2.

## P0 — stop before deeper feature work

### P0-1: Current branch does not typecheck or build

**Evidence**

- `bun run typecheck` fails in `packages/invoice-tools/src/handlers.ts:123`: `resolveDefaultIssuer()` returns `IssuerSnapshot | null`, but the receiving variable accepts `IssuerSnapshot | undefined`.
- The production build compiles, then fails on the same type error.
- This appeared during concurrent uncommitted default-issuer work.

**Fix**

- Normalize the nullable return contract or widen/narrow the local variable intentionally.
- Rerun typecheck, test, lint, and build from one stable commit before merging or deploying.

### P0-2: Code and database schema are out of sync

**Evidence**

- Core authenticated pages query `issuer_businesses.is_default`.
- The configured database does not have that column and returns PostgreSQL `42703`.
- Dashboard and issuer-dependent product areas fall into the app error boundary.
- An untracked `packages/db/sql/2026-08-13-default-issuer.sql` appeared during the audit.

**Impact**

The dashboard, invoice creation, invoice lists that join issuer data, and issuer management can all fail after a code deploy that precedes its schema migration.

**Fix**

- Use an explicit expand/migrate/deploy sequence and document the required order.
- Add a deploy-time schema compatibility check or migration status check.
- Prefer backward-compatible reads during rolling deployment when practical.
- Apply the migration only after reviewing the target database and rollback path, then repeat the full private-area walkthrough.

### P0-3: PDF image loading allows SSRF and unbounded resource consumption

**Evidence**

- `IssuerSnapshotSchema` accepts arbitrary URL strings for logo, stamp, and signature.
- Issuer settings allow saving pasted URLs directly.
- `loadImageForPdf()` fetches arbitrary `http:`, `https:`, and `file:` sources.
- The fetch has no protocol allowlist enforcement at the schema boundary, private/link-local/loopback IP rejection, redirect revalidation, DNS-rebinding defense, timeout, byte limit, dimension limit, or content-type validation.
- The unauthenticated `/api/demo/invoice-pdf` route renders a supplied invoice using the same path.

**Impact**

An attacker can make the server request internal services and can tie up memory, connections, and PDF workers with slow or oversized assets. If an internal response is a renderable image, its contents can potentially be returned inside the generated PDF.

**Fix**

- Remove `file:` support from runtime user data.
- Prefer UploadThing-owned asset IDs/URLs and reject arbitrary pasted URLs for new writes.
- If remote imports remain necessary, fetch through a hardened downloader that resolves and rejects private, loopback, link-local, multicast, and metadata ranges before every request and redirect.
- Enforce connect/read timeouts, redirect count, maximum bytes, image MIME/signature, decoded dimensions, and concurrency limits.
- Add SSRF tests for IPv4, IPv6, encoded/redirected targets, and DNS rebinding.

## P1 — high-priority hardening

### P1-1: The public PDF renderer is an unauthenticated compute endpoint

`POST /api/demo/invoice-pdf` accepts arbitrary invoice JSON and performs PDF/ISDOC.PDF rendering without authentication, bot verification, rate limiting, request-size limits, or bounded item/VAT-breakdown counts. Zod limits many individual strings but not total payload complexity.

Protect it with a small public-demo schema, request-body and collection caps, rate limiting, bot/abuse controls, render timeouts, and concurrency/backpressure. If it is not used by a public interactive demo, require a session.

### P1-2: Root lint is not a usable quality gate

**Evidence**

- `bun run lint` stops because `@invoicey/emails` has no `eslint.config.*`.
- A direct web lint reports 17 errors and 14 warnings, including render-time mutation/ref access, synchronous state updates inside effects, an impure `Date.now()` call, and missing hook dependencies.
- `packages/invoice-core` has a separate `prefer-const` error.

Add the missing email config, decide which vendored ReUI rules need narrow documented exceptions versus refactors, and make the root command green. Do not suppress the two shared field-component immutability errors; they affect reusable form semantics.

### P1-3: There is no pull-request CI quality gate

The only GitHub Actions workflow is semantic release on pushes to `main`. There is no PR/push workflow for frozen install, lint, typecheck, unit tests, production build, schema compatibility, or browser smoke tests. Local Husky hooks are bypassable and do not replace CI.

Add a required CI workflow with cached Bun/Turbo steps and branch protection. Release should depend on the same verified commit, not run independently of validation.

### P1-4: Baseline browser security headers are absent

The local HTML response exposes `x-powered-by: Next.js` and does not set a CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, or frame-ancestor protection. HSTS should be set by the production edge only after confirming HTTPS coverage.

Set `poweredByHeader: false` and define an environment-aware header policy. Start CSP in report-only mode because OAuth, UploadThing, Vercel analytics, embedded PDFs, and Eve/Slack integrations need an explicit inventory.

### P1-5: Issued documents can be silently regenerated

For non-imported issued invoices, `serveInvoicePdf()` and `serveInvoiceIsdoc()` fall back to artifact creation or live rendering when the stored URL is missing/unavailable. A later renderer, font, or template version can therefore return a visually different document for an already-issued invoice.

Treat every issued artifact as immutable, not only imports. Persist and verify hashes at issue time, serve the stored bytes, and return a clear unavailable/recovery error instead of silently regenerating. If disaster recovery regeneration is retained, make it an explicit audited admin operation with renderer/version provenance.

### P1-6: Error UI can disclose implementation details

The app error boundary renders `error.message`. During the schema mismatch it displayed the SQL query, table/column names, workspace identifier, and database failure to the signed-in user. Development logs also retain full stack traces.

Render a stable localized message and opaque reference only. Capture the detailed error server-side through structured logging/observability with sensitive-field redaction.

### P1-7: Fallback workspace resolution is not persisted

When the active organization is absent or membership was revoked, `requireWorkspace()` selects the oldest remaining membership but does not update the Better Auth session's `activeOrganizationId`. Invoicey pages may use the fallback workspace while Better Auth organization APIs still see a null or stale active organization.

Persist the resolved fallback (or force a deliberate workspace selection) and add tests covering membership removal, invitation acceptance, API-key defaults, and provider APIs immediately after fallback.

## P2 — correctness, accessibility, and product polish

### P2-1: Documentation language metadata and landmark mismatch

`/docs` is English but rendered with `<html lang="cs">`, and the audited docs landing page had no `<main>` landmark. This harms screen-reader pronunciation and search metadata. Give docs an English language boundary and a main landmark, or localize docs and set the language per document.

### P2-2: Auth-style pages contain two level-one headings

Sign-in and invalid-referral pages expose both the marketing/auth-shell statement and the page title as `h1`. Keep one page-level `h1`; demote the supporting shell headline.

### P2-3: Cookie settings control emits a Base UI runtime warning

`CookiesPage` wraps `C15tSettingsLink` with the shared `Button`, which infers `nativeButton={false}` although the rendered component is itself a button. Base UI warns about non-native attributes/handlers on a native button. Render a single native button or pass the correct primitive contract.

### P2-4: Navigation and version strings leak implementation defaults

- Settings breadcrumbs expose raw route segments such as `usage` instead of localized labels.
- The sidebar reports `v0.1.0` while the root release package is `1.23.0`; clarify which version is authoritative and source it consistently.
- A Czech workspace can retain Better Auth's English default name (`<name>'s workspace`). Localize bootstrap naming or require a name during onboarding.

### P2-5: Sitemap timestamps change on every render

Every sitemap entry uses `new Date()` as `lastModified`, so unchanged docs and legal pages appear freshly modified on every generation. Use content/git dates or omit `lastModified` when no durable value exists.

### P2-6: Download filenames are not normalized

Invoice numbers allow general strings, then flow into quoted `Content-Disposition` filenames. Newlines should be rejected by the Headers API, but quotes, slashes, control characters, and non-ASCII values can still produce invalid or confusing filenames.

Normalize to a safe ASCII fallback and add RFC 5987 `filename*` for Unicode display names.

### P2-7: Legal pages are explicitly incomplete for public launch

Privacy and terms state that operator identity/contact and commercial terms will be added later. That is acceptable for the stated private beta, but it must be a launch checklist blocker before opening self-serve or paid access.

### P2-8: Browser and accessibility regression coverage is missing

No Playwright/Cypress/browser E2E, axe, or Lighthouse setup was found. Add a small deterministic suite covering:

- public marketing, locale switching, legal pages, and docs;
- OAuth callback/session bootstrap through a test provider or seeded test session;
- onboarding and first issuer;
- web, JSON, and AI draft creation without issuing;
- issue/download/send/mark-paid lifecycle against test storage/email;
- client/issuer/workspace tenant isolation;
- import and recurring draft flows;
- mobile navigation, keyboard operation, landmarks, names, and contrast;
- error boundaries and missing-schema/dependency degradation.

## Verification record

| Check                     | Result                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| Local dev server          | Started successfully; public pages healthy                                                       |
| Public/browser smoke      | Passed for marketing, docs, legal, sign-in, and invalid-link surfaces, with issues above         |
| OAuth                     | GitHub sign-in completed                                                                         |
| Authenticated smoke       | Settings, workspace, and AI-usage pages rendered; issuer-dependent areas blocked by schema drift |
| Unit tests                | Passed (final snapshot: 243 tests across six packages)                                           |
| Typecheck                 | Failed in current uncommitted default-issuer work                                                |
| Lint                      | Failed: missing email config; web 17 errors/14 warnings; invoice-core 1 error                    |
| Production build          | Compiled, then failed on the same TypeScript error                                               |
| Dependency advisory audit | Not run; external advisory upload was not authorized by the environment                          |

## Retest checklist after P0 fixes

1. Confirm a clean/stable working tree and record the commit SHA.
2. Review and apply the default-issuer migration to a non-production database.
3. Run `bun run lint`, `bun run typecheck`, `bun run test`, and `bun run build` with no cached failures.
4. Repeat authenticated browser coverage for dashboard, invoice list/detail/new/AI/JSON/import/recurring, clients, issuers and all issuer tabs, members, integrations, API keys, security, referrals, and platform admin.
5. Exercise desktop and mobile breakpoints plus keyboard-only navigation.
6. Verify issued PDF and ISDOC bytes/hashes remain identical across download attempts.
7. Verify SSRF/resource-limit tests and public PDF endpoint rate limits.
8. Run a dependency advisory audit after explicit approval to send dependency metadata to the advisory service.
