# Invoicey brand assets and external surfaces

Invoicey uses a geometric `I` monogram as its compact product identity and a
custom `Invoicey` wordmark as its full signature. The wordmark's orange dot
replaces the dot above the second `i`; it is never an additional dot.
The document character remains optional supporting delight on secondary
marketing and assistant surfaces; it is never the primary brand or product
explanation. The monogram is the default for browser chrome and dense UI because
it stays legible below 48 px. The wordmark is the default anywhere the brand has
enough horizontal room.

## Repository assets

| Asset                                                              | Intended use                                        |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| `apps/web/public/brand/invoicey-mark.svg`                          | Canonical compact `I` monogram                      |
| `apps/web/public/brand/invoicey-lockup.svg`                        | Light wordmark for graphite/dark surfaces           |
| `apps/web/public/brand/invoicey-lockup-on-light.svg`               | Graphite wordmark for light surfaces                |
| `apps/web/public/brand/invoicey-app-icon.svg`                      | Source for app-icon raster derivatives              |
| `apps/web/public/brand/invoicey-social-card.svg`                   | Source for the composed social-sharing preview      |
| `apps/web/public/brand/invoicey-logo.png`                          | Backwards-compatible square app-icon raster         |
| `apps/web/public/brand/invoicey-logo-192.png`                      | Email and PWA icon                                  |
| `apps/web/public/brand/invoicey-logo-512.png`                      | PWA high-resolution icon                            |
| `apps/web/public/brand/illustrations/invoicey-mascot.webp`         | Interactive hero and page companion                 |
| `apps/web/public/brand/illustrations/invoicey-document.webp`       | Decorative document/check mark                      |
| `apps/web/public/brand/illustrations/invoicey-mascot-branded.webp` | Large CTA artwork                                   |
| `apps/web/public/brand/illustrations/invoicey-wordmark.webp`       | Wide dark brand artwork; do not use as a small logo |
| `apps/web/public/brand/models/invoicey.glb`                        | Optimized interactive hero model                    |
| `apps/web/app/opengraph-image.png`                                 | 1200×630 social card, derived from social-card SVG  |
| `apps/web/public/brand/external/invoicey-slack-icon.svg`           | Full-bleed source for the Slack app icon            |
| `apps/web/public/brand/external/invoicey-slack-512.png`            | Slack app/bot icon                                  |
| `apps/web/public/brand/external/invoicey-google-oauth-120.png`     | Google OAuth consent-screen logo                    |
| `apps/web/public/brand/external/invoicey-github-oauth-200.png`     | GitHub OAuth app badge                              |
| `apps/web/public/brand/downloads/invoicey-brand-guidelines.pdf`    | Downloadable identity and rollout manual            |
| `apps/web/public/brand/downloads/invoicey-brand-kit.zip`           | Packaged source and provider-ready brand assets     |

The marketing site, public brand page, web app, docs shell, sign-in shell,
Slack-link page, sidebars, transactional emails, favicon, Apple icon, PWA
manifest and social sharing metadata all read from these repository assets.
They update with the next production deployment. The macOS companion copies the
same source identity into its own repository so its app bundle and menu-bar mark
can ship independently.

## Logo selection

- Use the **wordmark** for marketing navigation/footer, auth, documentation,
  expanded sidebars, README headers, presentations, and partner pages.
- Use the **monogram** for favicons, PWA/app icons, the macOS menu bar, collapsed
  navigation, Slack, Google OAuth, GitHub OAuth, and other square placements.
- Keep clear space around either asset equal to at least the monogram stem width.
- On dark/graphite surfaces use `invoicey-lockup.svg`; on light surfaces use
  `invoicey-lockup-on-light.svg`.
- Never add another dot to the wordmark or recolor a different letter orange.

## Interactive hero model

The checked-in GLB is rendered by Three.js only as optional supporting delight.
`invoicey-3d-asset.ts` loads, normalizes and disposes the asset;
`invoicey-3d-scene.ts` owns lighting, rendering and animation; and
`invoicey-3d-canvas.tsx` controls browser loading and lifecycle. The production
asset is derived from the Hi3D export supplied on 2026-08-27. It is simplified,
quantized and uses 1024 px WebP textures; do not replace it with the 57 MB source
export.

The model follows the pointer, subtly floats and responds to hero scroll, and
grows on hover. Clicking triggers a short squash-and-stretch hop. The supplied
GLB is a single static mesh without a skeleton or animation clips, so individual
eyes, hands and feet cannot move independently without a future rigged export.
It is dynamically imported only on fine-pointer screens at least 768 px wide,
pauses outside the viewport and caps device pixel ratio. The existing mascot
WebP remains the automatic fallback for touch/mobile layouts, reduced-motion
preferences, WebGL failures and lost GPU contexts.

## External update checklist

Repository deployment cannot change provider-hosted branding. Update each
surface manually after deploying the matching homepage assets.

### Slack app created through Vercel Connect

1. Open the [Slack app management dashboard](https://api.slack.com/apps) and
   select the Slack app attached to the `slack/invoicey` Vercel Connect
   resource.
2. Open **Basic Information → Display Information**.
3. Set the app name to `Invoicey`, update the short description if needed, and
   upload `apps/web/public/brand/external/invoicey-slack-512.png` as the app
   icon.
4. Save changes. A display-only update does not add scopes or change the Eve
   trigger. Do not detach/recreate the Connect resource just to change the icon.

The prepared Slack asset is 512×512. It uses a full-bleed square graphite field:
Slack applies its own rounding, so do not upload a pre-rounded field or
transparent corner gutter.
The visible Slack icon is owned by the Slack app's display settings; the Vercel
project or team avatar does not replace it.

### Google OAuth consent screen

1. Open the production Google Cloud project used by `GOOGLE_CLIENT_ID`.
2. Go to **Google Auth Platform → Branding**.
3. Keep the application name `Invoicey` and upload
   `apps/web/public/brand/external/invoicey-google-oauth-120.png`.
4. Confirm the homepage, privacy policy and terms URLs still use
   `https://invoicey.ditrich.me`.
5. Save, complete brand verification if requested, and publish the verified
   branding.

Google recommends a square 120×120 image under 1 MB. Changing the logo of an
external production app can create a new draft brand version that must be
verified and published before users see it.

### GitHub OAuth app

1. Open **GitHub → Settings → Developer settings → OAuth Apps**.
2. Select the production Invoicey OAuth app.
3. Under **Application logo**, upload
   `apps/web/public/brand/external/invoicey-github-oauth-200.png` and confirm the
   crop.
4. Set the badge background to `#0b0b0c` and save the application.

GitHub recommends a square image of at least 200×200 and under 1 MB. The
prepared graphite tile keeps the monogram comfortably inside GitHub's circular
badge crop.

### Vercel

Vercel Connect does not replace the Slack app's display icon: update Slack as
described above. The Vercel project itself has no product-logo field that is
used by the deployed website.

If Invoicey is also registered as a separate **Vercel App** for “Sign in with
Vercel,” update that unrelated app under **Team Settings → Apps** and upload the
512 px Slack/app icon. A personal or team avatar is dashboard chrome only and
does not affect Invoicey users.

### Other surfaces

- **Resend email templates:** no console update is required. Templates load the
  deployed `/brand/invoicey-logo-192.png` URL.
- **Browser/PWA icons and social cards:** no console update is required. Deploy
  the web app, then allow browser and link-preview caches to expire.
- **Workspace and issuer logos:** do not overwrite customer-controlled assets.
  The Invoicey product brand is separate from workspace chrome and logos shown
  on issued invoices.

## Guardrails

- Keep the simplified monogram for placements below 48 px. Use the fieldless
  `invoicey-mark.svg` inside authored UI and the graphite-field app icon for
  square provider/app placements.
- `invoicey-lockup.svg` embeds vector outlines generated from Next's checked-in
  `dist/compiled/@vercel/og/Geist-Regular.ttf`; it has no runtime font
  dependency. Its `#f5f5f4` wordmark is for graphite/dark surfaces; use
  `invoicey-lockup-on-light.svg` on light surfaces.
- Derive every raster product asset from `invoicey-mark.svg`,
  `invoicey-app-icon.svg`, or `invoicey-social-card.svg`; do not hand-edit
  divergent identity variants.
- Preserve transparent padding; do not stretch or crop the mascot's hands,
  shoes or check token.
- Treat the mascot as supporting personality, not a substitute for product
  explanation or validation feedback.
- Respect `prefers-reduced-motion` and keep interactive art non-blocking for
  keyboard and touch users.
