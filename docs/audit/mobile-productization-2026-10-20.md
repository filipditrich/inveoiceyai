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

## Public guide consistency pass — 21 October

Audited public instructions against the current app and shared tool implementation. Corrected eleven MDX pages: the docs landing page; client, invoice creation and issuer guides; API key, MCP, Cursor, Claude Code and Slack setup; MCP tool reference; and troubleshooting. The docs landing page now exposes the public ChatGPT installation guide.

| Incorrect or incomplete guidance                                     | Current implementation evidence                                                                 | Correction                                                                                                                                 |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| An assistant must select an issuer preset or gets a fictional seller | `register-mcp-tools.ts`, `agent/tools/create_invoice.ts`, `invoice-ops.ts:resolveDefaultIssuer` | Configure the workspace business/default; inspect with `get_workspace`; missing usable issuer blocks connected-workspace drafts            |
| API keys grant unrestricted workspace actions                        | `lib/mcp/authenticate.ts`, `access-policy.ts`                                                   | Personal keys have read/write capability but current membership and permissions still apply; OAuth also checks consent scopes              |
| Clients referenced by invoices can be deleted                        | `actions/clients.ts:deleteClient`                                                               | Referenced clients are protected, including draft and recurring-template references                                                        |
| Only monthly/quarterly runs and days 1–28                            | `recurring.ts`, `save-recurring-sheet.tsx`, `recurring-table.tsx`                               | Weekly/monthly/quarterly/yearly; explain actual day presets, draft-only behavior and list controls                                         |
| Every Slack draft uploads document attachments                       | `agent/tools/create_invoice.ts`                                                                 | Draft review cards expose an explicit preview; revisions do not automatically upload documents                                             |
| Only CZK, Czech document labels and Fio are available                | Invoice schema and current bank services                                                        | Document supported invoice currencies/languages and Fio/MONETA; preserve CZK-only QR and optional exact-match auto-confirmation boundaries |

Added the MCP Accept header to diagnostic examples. Removed preset-selection examples that conflicted with the connected tools. No authentication policy, invoice data, bank setting or legal text was changed.

The first local public run passed 28 checks but returned 404 for docs in six desktop/phone cases. The compiled loader contained all document entries. Stopped the supervised server, removed only its generated `.next/dev` cache, then restarted; docs rendered normally. The six failed checks were rerun unchanged and passed, completing the existing 34 public desktop/phone cases across the initial and focused runs. No test assertion or production loader was weakened to hide the failure. Local browser inspection also confirmed the updated landing page and Slack guide render, and setup instructions now link directly to the current workspace settings routes.

## Structured draft recovery under storage restrictions — 21 October

A new isolated browser case reproduced the invoice editor falling into its Something went wrong boundary when accessing session storage threw SecurityError. Unchecked accesses also existed in debounced recovery writes, recovery deletion, creation-marker writes and success-redirect cleanup.

Added a shared guarded storage boundary covering acquisition of the storage object and each recovery operation. New-invoice editing shows localized Czech/English guidance when recovery is unavailable, stops automatic retries, and leaves explicit Save draft usable. Failed deletion keeps the visible recovered invoice intact. Client creation uses the same guarded immediate-copy path. Success tracking continues even when optional storage cleanup is unavailable.

The stricter browser assertions also exposed a separate redirect race: the toast component's router replacement could restore recoveryAttempt after the tracker removed it. Toast URL cleanup now removes that tag as well. Both storage-denied and quota-exceeded cases save to the isolated workspace and reload from the saved invoice, without browser exceptions.

Five added unit cases cover denied object access, reads, writes, removal and working recovery. All 464 web tests pass. Removing the new storage guard made four refusal cases fail; the guard was restored. An initial combined desktop/phone run passed 35 checks with the two existing issued-invoice cases skipped. After adding the URL assertions and fixing the race, all 19 focused storage and client-handoff checks passed, including clean redirect URLs. A separate focused run saved desktop/phone screenshots for visual review. All fixture writes remain local synthetic drafts. This pass did not create, issue, email or mark any production invoice paid. Final fixture verification found 30 invoices, all unissued and unpaid. The local server and disposable database were stopped, original environment symlinks and database adapters restored, and web typechecking and formatting passed.

## Issued documents and framing headers — 21 October

Closed the two previously skipped invoice-detail cases using invoices issued through the real web flow in a disposable local workspace. No production invoice was created, issued, emailed or paid. Email transport and artifact uploads were disabled. Four synthetic invoices were issued across the failing and passing runs; all remained unpaid.

The new browser test reproduced an integration bug missed by the PDF handler unit tests: Next's global X-Frame-Options DENY overwrote the inline route's SAMEORIGIN header. Added a narrow configuration override for `/api/invoices/:id/pdf?disposition=inline`; ordinary downloads retain DENY. The inline response retains its enforced same-origin CSP, and its report-only framing policy now agrees.

The issued-document flow passes on desktop and the Pixel browser profile: frozen line data survives reload, the issue action disappears, PDF bytes and download headers are valid, inline framing headers permit only this origin, ISDOC includes the synthetic supplier, description and independently expected 1,250 CZK total, and the phone uses the compact PDF card without an iframe or horizontal overflow. Both detail pages have no serious or critical axe findings. The initial phone text locator matched only the hidden desktop table because the visible card prefixes the line number; corrected the new test's selector to target the rendered card while preserving its content assertion.

All 19 unchanged authenticated checks pass with the issued fixture, including lifecycle guidance and invalid-recipient blocking on both profiles. The new issuance suite adds two passing scenarios plus its auth setup. Inspected the phone screenshot. Stopped the local dev server and database, restored the original adapters/environment links, and confirmed no QA adapter diff remains. Native ChatGPT iOS/Android testing remains separate from these browser checks.

## Optional desktop promotion on invoice detail — 21 October

The phone screenshot showed the Mac-only Invoicey Drive promotion above the invoice header. Its unguarded local-storage read also crashed the full detail route when browser storage was denied; a failed preference write prevented Dismiss from taking effect. Reproduced denied getter/read crashes and failed dismissal on desktop, plus the irrelevant phone promotion after hydration.

Guarded preference reads and writes. The promotion can be dismissed for the current visit even without persistent storage. Normal dismissal still persists across reload. Hid the desktop promotion below the medium breakpoint so phone users reach invoice actions directly. No new product copy or settings behavior was introduced.

Added eight local desktop/phone cases for getter/read/write failures, normal persistent dismissal, and the phone layout. The initial tests used a link role for a control rendered with button semantics; corrected the selector to the actual download href. The phone visibility check now waits for the preference effect to finish, avoiding a false pass before hydration. All 27 combined new and unchanged authenticated checks pass. Inspected the resulting phone screenshot. One synthetic local invoice was issued by the existing fixture flow and remained unpaid; email transport and uploads were disabled. Stopped the local server and database and restored the original environment links and adapters.

## iPhone WebKit coverage and Safari interaction fixes — 21 October

Added a maintained iPhone 13/WebKit project alongside desktop and Pixel Chromium, and made CI install both engines explicitly. Existing mobile-specific test scaffolding now follows the project's mobile setting rather than a Chromium project name; scenarios and assertions remain intact. The public brand-image selector accepts Next's production deployment query parameter while still requiring the dark wordmark to be visible.

The first live WebKit run passed 21 checks and found the reset dialog's confirmation button intercepted by a pending cookie banner. The image selector also failed despite the image loading correctly. The consent banner is now visually hidden while Base UI marks it outside the active modal, then returns with the same pending choices after cancellation. Added an explicit fresh-consent regression; authenticated setup carries a consent cookie, so this case clears that preference rather than assuming a fresh visitor.

Authenticated WebKit tests reproduced description text disappearing before React Hook Form had finished setting up its subscriptions. The server-rendered editor now uses a disabled fieldset until formState.isReady, preventing edits that cannot yet be retained. Existing storage, save and issuance cases then preserved the text. Safari also exposed unnamed button-role focus guards in the dialog library. Added scoped labels in the shared dialog/sheet portals, retaining their VoiceOver focus behavior and cleaning up the observer when each portal unmounts. Labels follow the Czech/English catalogs.

Initial development runs also recorded Next development transport/source-map errors on rapid reload. Built and tested the isolated production app instead of filtering page errors from the tests. The temporary local database adapter explicitly refused unsupported MCP batch revocation; it was never part of the release. All 48 WebKit checks then passed, including all existing storage error assertions. Inspected the iPhone issued-invoice screenshot.

The desktop/phone Chromium production run passed 94 of 95 checks. Its remaining accessibility finding was a preview-error label with 4.17:1 contrast against the dark translucent surface. The local production preview service returned an expected BotId configuration error outside Vercel, exposing this real error-state contrast bug. Added a deterministic service-failure case that failed for the same contrast reason, and changed the error text to the existing accessible destructive foreground token. No BotId protection was bypassed or changed.

After the contrast change, all 19 focused dialog/issuance/failure-state checks passed across desktop Chromium, Pixel Chromium and iPhone WebKit, including the unchanged check that had failed. The previous 48 WebKit and 94 passing Chromium checks cover the remaining unchanged flows. The production build passed. The final local fixture contained 29 synthetic invoices, seven issued and none paid. Email and UploadThing were disabled throughout. Stopped the supervised production QA server and disposable database and restored the original adapters/environment symlinks. Native ChatGPT iOS/Android app testing is still not claimed by these browser-engine results.

## Payment lifecycle, role boundaries and notification cleanup — 21 October

Added local browser coverage for a 1,250 CZK invoice: record 500 CZK, verify 750 CZK outstanding, block cancellation while an allocation exists, settle only the remaining 750 CZK, reverse both entries without deleting their history, and cancel while retaining the invoice number. The cancelled-page accessibility check reproduced insufficient contrast on destructive buttons; switched their text to the existing destructive foreground token. Reduced-motion browser settings keep the page audit from sampling a toast mid-animation. Initial test scaffolding was corrected to use the actual Payment recorded notification and Matching page title.

The review found four server actions lacking the payments:manage gate used by other payment mutations: manual recording, allocation reversal, match confirmation and match rejection. Added the gate before workspace access and side effects. All four new denied-action tests failed before the fix, while the four authorized-manager tests already passed; all eight pass after it.

Separate synthetic viewer and payment-reader sessions reproduced ledger/control exposure on invoice detail. Allocation history is now queried/rendered only with payments:read; mark/unmark/reverse controls require payments:manage, and collection data is loaded only for payment managers. The restricted sessions are distinct local users and do not alter the owner fixture. Browser cases verify a viewer can read the invoice without receiving its ledger and a payment reader can read the ledger without payment mutation controls.

A WebKit navigation interruption after issue led to a deterministic notification cleanup check: cleaning a toast URL started redundant RSC requests, which could race the next page. The existing tracker already used native history replacement; toast cleanup now uses the same approach, preserving unrelated query parameters, hash and router state without fetching the page again. Faster cleanup exposed repeated Draft saved toasts in the existing client-handoff test. Normal action notifications now reuse a stable per-action toast ID instead of stacking identical active messages. The existing assertion was preserved.

The development regression run passed 48 of 55 checks; three failed for duplicate notifications and four WebKit cases recorded development reload/source-map transport errors. Fixed the duplicate notification behavior and tested a production build instead of filtering those browser errors. All financial mutations in this pass are synthetic local allocations/reversals; external email and artifact uploads remain disabled. Restricted fixtures require INVOICEY_E2E_VIEWER_AUTH_STATE and INVOICEY_E2E_PAYMENT_READER_AUTH_STATE, plus an explicitly seeded partial invoice.

Final production-build validation passed all 67 combined browser checks across desktop Chromium, phone Chromium and iPhone WebKit, preserving the existing assertions. Final fixture readback: 39 invoices, 15 issued, 11 cancelled; zero cancelled invoices retained an allocated balance. Three partial-payment allocations remained for the restricted-reader fixture and 22 allocations were reversed, retaining their history. The local server and database were stopped and original environment links/adapters restored. No production financial data or bank connection was used.

## Invoice role controls and direct document access — 21 October

Extended the invoice-role audit beyond payment controls. Viewer accounts still saw issue/edit/duplicate/recurrence/send/cancel/delete controls even though the corresponding server mutations were protected. Added a localized read-only explanation and gated each detail action using the same effective permission as its server action. The existing recurring-origin marker remains visible as text when its management page is unavailable.

An invoice issuer retains draft editing, duplication, issuing, sending and recurring controls, but not deletion or payment controls. When allocated payments prevent cancellation, the sheet now distinguishes management, read-only ledger access and no ledger access. People without payment management are directed to a teammate; the ledger link is omitted when they cannot read it. Updated the public workspace guide from its older three-role table to the current owner/admin/accountant/issuer/viewer model and explained read-only invoice behavior and plan-dependent overrides.

A separate synthetic member explicitly denied invoices:read reproduced a direct PDF request returning 200. Invoice detail now checks effective invoice-read permission before loading its row and uses the normal not-found boundary when denied. PDF and ISDOC routes now return 403 before querying or rendering a document when the signed-in member lacks that permission; anonymous behavior and workspace isolation remain unchanged. Allowed viewers retain document downloads, including draft and cancelled-history documents.

Added six local scenarios per browser profile covering draft/issued/cancelled viewer pages, an authorized issuer's actions, blocked cancellation guidance, and denied detail/document requests. Initial viewer/issuer cases and the explicit PDF-denial case failed before the changes. All 19 development checks passed afterward. Production-mode validation also includes the existing owner lifecycle, payment-role, file-delivery and email-validation suites. All identities and financial records used here are synthetic local fixtures; external mail and artifact uploads are disabled.

All 64 combined production-build checks passed across desktop Chromium, phone Chromium and iPhone WebKit. Inspected the phone read-only screenshot: document downloads remain available and unavailable actions are absent, with a clear explanation before the invoice facts. Final local fixture readback contained 63 invoices, 52 issued and 13 cancelled; no cancelled invoice retained an allocated balance. The supervised server and database were stopped and original database adapters/environment links restored. No production identity, invoice or payment was changed.
