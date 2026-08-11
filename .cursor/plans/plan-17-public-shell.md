# Plan 17 — Public website and entry shell

Maps to roadmap **Plan 17**. Spec: [`docs/specs/public-shell.md`](../../docs/specs/public-shell.md).

## Goal

Ship a compact public exterior for Invoicey: one strong Czech landing page, cohesive OAuth/onboarding screens, essential legal routes, launch metadata, and a first-party consent experience.

## Exit criteria

- [x] `/` is a public, responsive, server-rendered product page; it no longer redirects to `/dashboard`
- [x] Shared public header/footer use anchored homepage navigation and legal links
- [x] `/sign-in` and `/onboarding` match the public visual system and preserve existing auth behavior
- [x] `/privacy`, `/terms`, and `/cookies` exist with factual beta-appropriate copy
- [x] c15t's stock banner is replaced by an Invoicey-native consent bar and preferences sheet
- [x] Vercel Analytics loads only after `measurement` consent
- [x] Metadata, canonical URLs, sitemap, robots, and social preview are present
- [x] Mobile/desktop and light/dark browser smoke passes
- [x] Typecheck, lint, tests, and production build pass
- [x] Deslop pass and conventional commit complete

## Explicitly out of scope

- Separate `/features`, `/ai-invoicing`, `/pricing`, `/about`, or `/security` marketing pages
- Blog, docs portal, contact form, newsletter, testimonials, or a CMS
- Password authentication, billing, checkout, or pricing plans
- New marketing/advertising trackers
