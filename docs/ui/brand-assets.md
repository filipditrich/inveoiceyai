# Invoicey brand assets and external surfaces

Invoicey uses a document character as its expressive marketing mascot and a
simplified document/check mark as its small product mark. The small mark is the
default for browser chrome and dense UI because it stays legible below 48 px.
Detailed renders are reserved for hero art, social previews, app profiles and
other large placements.

## Repository assets

| Asset                                                              | Intended use                                        |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| `apps/web/public/brand/invoicey-logo.png`                          | Canonical square product mark used by `BrandLogo`   |
| `apps/web/public/brand/invoicey-logo-192.png`                      | Email and PWA icon                                  |
| `apps/web/public/brand/invoicey-logo-512.png`                      | PWA high-resolution icon                            |
| `apps/web/public/brand/illustrations/invoicey-mascot.webp`         | Interactive hero and page companion                 |
| `apps/web/public/brand/illustrations/invoicey-document.webp`       | Decorative document/check mark                      |
| `apps/web/public/brand/illustrations/invoicey-mascot-branded.webp` | Large CTA artwork                                   |
| `apps/web/public/brand/illustrations/invoicey-wordmark.webp`       | Wide dark brand artwork; do not use as a small logo |
| `apps/web/app/opengraph-image.png`                                 | Social sharing preview                              |
| `apps/web/public/brand/external/invoicey-slack-512.png`            | Slack app/bot icon                                  |
| `apps/web/public/brand/external/invoicey-google-oauth-120.png`     | Google OAuth consent-screen logo                    |
| `apps/web/public/brand/external/invoicey-github-oauth-200.png`     | GitHub OAuth app badge                              |

The web app, docs shell, sign-in shell, Slack-link page, sidebars, transactional
emails, favicon, Apple icon, PWA manifest and social sharing metadata all read
from these repository assets. They update with the next production deployment.

## Interactive hero model

The landing-page hero uses a procedural Three.js model rather than a checked-in
GLB file. `invoicey-3d-model.ts` builds the character from rounded panels,
capsules, curves and physical materials; `invoicey-3d-scene.ts` owns lighting,
rendering and animation; and `invoicey-3d-canvas.tsx` controls browser loading
and lifecycle.

The model follows the pointer with its body, pupils and approval token, subtly
responds to hero scroll, blinks, breathes, shifts its feet and grows on hover.
Clicking triggers a short squash-and-stretch hop with an asymmetric arm wave.
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

Slack accepts app icons from 512×512 to 2000×2000. The prepared asset is
512×512. The visible Slack icon is owned by the Slack app's display settings;
the Vercel project or team avatar does not replace it.

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
4. Set the badge background to `#fffaf6` and save the application.

GitHub recommends a square image of at least 200×200 and under 1 MB. The
prepared transparent mark is designed to sit inside GitHub's circular badge.

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

- Keep the simplified product mark for placements below 48 px.
- Preserve transparent padding; do not stretch or crop the mascot's hands,
  shoes or check token.
- Treat the mascot as supporting personality, not a substitute for product
  explanation or validation feedback.
- Respect `prefers-reduced-motion` and keep interactive art non-blocking for
  keyboard and touch users.
