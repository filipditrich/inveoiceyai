# Public website and entry shell (Plan 17)

## Goal

Give Invoicey a coherent public exterior around the existing authenticated web app: one substantial Czech landing page, polished OAuth and recovery onboarding screens, concise legal pages, and privacy controls that look and behave like Invoicey.

The public website is intentionally small. Product explanation lives on `/`; separate feature, AI, pricing, about, or security marketing pages are out of scope until there is enough distinct content to justify them.

## Routes

| Route         | Purpose                                                               |
| ------------- | --------------------------------------------------------------------- |
| `/`           | Public product landing page and primary acquisition surface           |
| `/sign-in`    | Google/GitHub OAuth entry with safe `next` handling                   |
| `/onboarding` | Recovery path for a signed-in user without a workspace                |
| `/privacy`    | Privacy information grounded in the application's actual data flows   |
| `/terms`      | Concise service terms for the current beta product                    |
| `/cookies`    | Cookie categories, current usage, and a control to reopen preferences |
| `/dashboard`  | Existing authenticated product; unchanged                             |

## Information architecture

The public header links to anchored sections on the homepage rather than thin subpages:

- Product overview
- Workflows
- Automation
- FAQ
- Sign in / open app

The footer contains the legal routes and a first-party cookie-preferences control.

## Landing-page content

1. **Hero:** Czech-first invoicing with one direct CTA and a real-product-inspired dashboard preview.
2. **Trust strip:** PDF, ISDOC, SPAYD QR, ARES, and immutable issued artifacts.
3. **Core workflow:** create, issue/send, and track/import.
4. **Structured-data advantage:** the same validated invoice contract serves web, JSON, MCP, and Slack. Automation is described as beta until its operator smoke checklist is complete.
5. **Multiple businesses:** issuer-specific banking, numbering, branding, and VAT settings.
6. **FAQ:** short answers to the practical questions a Czech freelancer or small team has before signing in.
7. **Final CTA:** open the application.

No customer logos, testimonials, usage counters, prices, certifications, or security guarantees are invented.

## Visual system

- Follow the maintained [visual system](../ui/visual-system.md) and
  [brand-asset guidance](../ui/brand-assets.md): use the canonical geometric
  Invoicey mark, semantic graphite/orange tokens, and dark-first presentation.
  Light and system preferences remain supported; neither restores the retired
  peach/chocolate treatment.
- Keep the page server-rendered. Only mobile navigation, theme control, OAuth actions, and consent controls may require client JavaScript.
- Product previews are code-native, populated, and based on existing app UI so
  they remain crisp, credible, and do not introduce heavyweight media.
- Respect reduced-motion preferences and retain visible keyboard focus.

## Consent UX

The c15t consent store remains the source of truth, but its stock banner and branding are not used.

### First visit

- Show a slim, non-blocking bottom bar without an overlay or scroll lock.
- Explain the actual choice in plain Czech.
- Present equally available choices for necessary-only and measurement consent, plus a quieter settings action.
- Link to `/cookies` and `/privacy`.

### Preferences

- Open a first-party Invoicey sheet/dialog with category descriptions.
- `necessary` is always enabled and cannot be changed.
- Optional categories can be changed individually and saved.
- The footer and `/cookies` can reopen preferences after a choice.
- Vercel Analytics renders only when `measurement` consent is active.

The current product does not configure marketing scripts. The consent copy must not imply otherwise.

## Legal-content boundary

The pages describe verified product behavior and processors already present in the repository. They do not claim to be legal advice. Before a broad commercial launch, the operator must confirm legal identity/contact details, retention periods, processor agreements, and commercial terms.

## SEO and metadata

- Root metadata uses `NEXT_PUBLIC_APP_URL` for its metadata base and canonical URLs.
- Add per-route titles and descriptions, `robots.ts`, and `sitemap.ts`.
- Add a code-generated Open Graph image or a checked-in static social asset.
- Legal and auth pages remain indexable only where useful; `/sign-in` and `/onboarding` should not be indexed.

## Verification

- `bun run typecheck`
- `bun run lint`
- `bun run test`
- `bun run build` with the required build-time auth environment
- Browser smoke at desktop and Pixel 7 widths; a fresh visit is dark, while
  light and system preferences remain supported
- Signed-out `/dashboard` redirect and safe OAuth `next` redirect
- Fresh consent, necessary-only, measurement-enabled, preference edit, and reset flows

## Open operator follow-up

- Confirm the public legal identity and contact details before removing the beta wording from legal pages.
- Complete the existing Slack and email operator smoke checklists before marketing those workflows as generally available.
