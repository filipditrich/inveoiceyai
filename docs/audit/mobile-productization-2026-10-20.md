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

## Authenticated onboarding and drafting pass

Used a disposable loopback PostgreSQL database with synthetic users, issuer, client and an unissued CZK 1,250 English-language draft. Production providers were disabled throughout. Temporary local database adapters and environment overrides were restored after verification; the supervised server and disposable database were stopped.

Observed and fixed:

- Local HTTPS agent sign-in used a cookie name that differed from Better Auth's secure session cookie. The helper now uses Better Auth's configured name and attributes.
- Issuer captions did not label their inputs. Shared fields now associate captions with controls, including the nested ARES input. Label taps focus the input.
- Optional history import placed its skip action below nine providers. Skip now appears before the provider grid and is visible in the first phone viewport.
- Four invoice appearance checkboxes lacked accessible names. They now expose their translated labels.
- The empty PDF preview used dark-theme muted text on a white canvas. Its text now has sufficient contrast on that canvas.
- The closed assistant drawer retained keyboard-focusable controls. It is now inert while closed.

Evidence: four isolated onboarding browser cases passed across desktop and phone profiles before creating the fixture issuer. All 453 web unit tests and ten package typecheck tasks pass. Five new rendering regressions pass; restoring the old issuer field component made all four label cases fail, and the history-order test failed before its fix. The unchanged authenticated journey suite passes 17 checks across desktop and phone, including axe, navigation, overflow and structured draft recovery. Two issued-invoice lifecycle cases remain skipped because this fixture deliberately contains only an unissued draft. Free-plan navigation was checked first; Pro was then enabled only in the disposable database for the payment and assistant checks. No production invoice was created, issued, sent or marked paid.

The client-creation handoff observed in this pass: adding a client from a draft currently returns to the client list, requiring users to reopen their recovered draft and select the new client. Draft recovery itself worked. Native ChatGPT iOS/Android verification still requires a real phone session.

## In-place client creation pass — 21 October

Replaced the invoice builder's client-create navigation with a scrollable, labeled dialog. Saving selects the stored client without leaving the invoice, including when editing an existing draft. Cancellation restores focus and preserves invoice edits; server validation keeps client inputs available for correction. The page and dialog share the same permission, managed-catalog, schema and persistence path. Duplicate identities return the stored client ID and do not duplicate picker options.

The first browser regression failed because Add manually navigated away. Subsequent runs exposed a native select displaying the previous option after a dynamic addition and a reload beating the recovery debounce. The picker now follows form state, and the completed client handoff writes the new-invoice recovery snapshot immediately. ARES additions share that selection path. Explicit Save draft still controls persisted invoice changes.

Verification: 25 desktop/phone browser checks pass, including eight new handoff cases for create/reload/deduplication, cancel/focus/axe, invalid DIČ correction and existing-draft editing/save/reload. The two existing issued-invoice cases remain skipped; the fixture contains drafts only. All 459 web tests and ten package typecheck tasks pass. Six additional unit cases cover permission denial, managed catalogs and structured validation failures. Removing both production permission guards made the two corresponding tests fail; the guards were restored. The phone dialog was inspected at 390 × 844. All mutations used the disposable local database, with synthetic clients and eight unissued, unpaid drafts only. The QA server and database were stopped and the normal environment symlinks and database adapters restored.

Updated the creation guide with this workflow and corrected stale client documentation that claimed only CZK and Czech client addresses were supported. Native ChatGPT iOS/Android verification remains pending a real device.
