# Mobile verification and product follow-up

## Scope

Improve Invoicey across the ChatGPT integration, main web app, onboarding, reliability, performance and marketing. Ship changes from observed product problems, verify them, and preserve public claims that match the evidence. Native ChatGPT mobile support remains a required test, not a completed claim.

## Evidence from 20 October 2026

| Surface                      | Evidence                                                                                                                                                    | Status                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Public ChatGPT plugin        | Published 1.0.3; installed and connected workspace loads real invoices                                                                                      | Verified on desktop                  |
| Embedded app at phone width  | 390 × 844 live browser: invoice list, unpaid filter and invoice detail load                                                                                 | Verified responsive browser only     |
| Phone controls               | New Playwright regression failed on a 40px search input; CSS now gives buttons and text inputs 44px minimum height and the checkbox label a 44px touch area | Fixed; nine seeded MCP UI tests pass |
| iOS input sizing             | Input is already at least 16px; regression preserves this                                                                                                   | Verified in the browser              |
| Public setup guide           | 390px browser layout has no horizontal document overflow                                                                                                    | Verified on production               |
| Native ChatGPT iOS / Android | No real phone session is available through current browser tooling; local simulator discovery did not return and was stopped                                | Pending device test                  |

No production invoices were created, issued, sent, deleted or marked paid during this pass. Mutation controls were exercised only against the existing seeded test host.

## Repeatable MCP UI checks

From `apps/web`, build with `bun run build:mcp-ui`. Run `devd ls`, then start the seeded host with `devd up -- node scripts/dev-mcp-ui.mjs` if none is running. The host honors devd's `PORT`. Pass its reported URL as `MCP_UI_BASE_URL` to `bunx playwright test --config playwright.mcp.config.ts`. The Playwright configuration does not start an unmanaged server. Stop the devd id after verification.

## Real-device acceptance

On a phone signed into the same ChatGPT account, open the official public Invoicey listing linked from `/chatgpt#setup`. Confirm whether the listing and Open plugin action are available inside the native app. Open the connected workspace, filter unpaid invoices, open an invoice and return to the list. Check scrolling, keyboard behavior, safe areas and document opening. Record iOS/Android app and OS versions and any desktop-only message. Perform writes only in the dedicated review workspace with explicit action approval. Keep native availability wording conditional until this test passes.

## Next product passes

1. Verify the main web app's phone navigation and core invoice reading/drafting flows with seeded data; fix observed overflow, focus, keyboard and touch issues.
2. Verify new-user onboarding through first issuer and first draft; identify incomplete setup and authorization failures early with recoverable guidance.
3. Audit mobile loading states, failed requests, empty results and form recovery. Preserve entered draft data through recoverable errors.
4. Review public homepage, feature pages and setup guidance against actual released behavior in both Czech and English; correct unsupported or stale claims.
5. Measure core page loading and interaction delays, then optimize the measured bottlenecks and verify deployment behavior.

## Public navigation and setup pass

The production phone menu had no direct ChatGPT entry. Added a localized Invoicey in ChatGPT link to desktop and phone navigation and raised phone menu link targets to 44px. The new Czech and English browser journeys first failed because the entry was absent, then passed through navigation to the correct setup heading and public install URL. Pricing guidance now explains when upgrading helps instead of describing the internal billing integration.

All 34 public checks pass across desktop Chromium and the Pixel 7 browser profile, including landmarks, horizontal overflow, light/dark contrast, accessibility, locale handling, documentation navigation and browser hardening headers. Two request-client checks initially failed to trust the portless HTTPS certificate; rerunning those two with `NODE_EXTRA_CA_CERTS=$HOME/.portless/ca.pem` passed with certificate validation enabled. The browser-facing checks passed on the first full run. A malformed ignored Next dev type cache was regenerated after stopping the server.

Local public checks now use an already supervised server via `INVOICEY_E2E_BASE_URL`. CI retains its existing managed Playwright server startup. For local development, start with `devd up`, pass its URL to the test command, and stop that devd id once finished.

The temporary review-account password file from submission setup is no longer present. No production credential was reset or new account created. Main authenticated product journeys still need an isolated local fixture or restored reviewer access. Native ChatGPT iOS/Android testing remains pending a real phone session.

## Free generator recovery pass

Observed production behavior serialized the entire unissued invoice into `?d=` automatically, including party addresses, contact emails, bank fields and line items. The new recovery path keeps edits in the current tab's session storage instead. Existing links still import, then their draft query is cleared; invalid links fall back safely. The UI explains local recovery and storage failure in Czech and English, and confirms before replacing a draft. The cookies page now describes the functional draft storage.

Regression evidence: the old-link browser check failed against the previous implementation because `d` remained in the URL. Twelve browser checks now pass across desktop and phone profiles for import, reload, reset/cancel, blocked storage, Czech copy, invalid-link cleanup and issuer-prefill cleanup. Two additional failing unit cases reproduced delayed ARES responses replacing a party after its IČO changed; the response now applies only when its requested IČO still matches. Existing draft normalization coverage remains unchanged. The full web suite passes all 448 tests, and web typechecking passes after regenerating route types.

Verification uses synthetic invoice data only. No production invoice was issued or emailed. Native ChatGPT phone testing and authenticated main-app mobile verification remain open requirements.
