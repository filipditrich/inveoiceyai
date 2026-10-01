# ChatGPT integration validation — 2026-10-01

## Verified locally

- Turbo typecheck: 10 packages passed.
- Turbo tests: 854 tests across nine packages passed, including real Better Auth OAuth code/PKCE exchange, signed consent tampering, code replay, denied consent, workspace-bound refresh and removed membership.
- Full lint: exit 0; existing repository warnings remain. New OAuth, UI and test-host files pass the focused lint check.
- Next production build: passed, including the generated MCP App bundle and discovery routes.
- Official MCP SDK in-memory transport: denied requests stop before database access; invalid company IDs fail validation; side-effect annotations are exposed to the client.
- Official MCP AppBridge with seeded invoices: eight browser tests passed. Search, viewer restrictions, context attachment, retry, issue/email/payment confirmations, desktop light and mobile dark accessibility and overflow were exercised.
- Additive OAuth SQL applied atomically in disposable PostgreSQL 17. The auth schema checker verified all 14 Better Auth models.
- Built website: setup guide rendered and the feature link reached it. Local discovery returned S256 metadata; an unauthenticated MCP POST returned 401 with the resource-metadata challenge.

Screenshots: `screenshots/chatgpt-workspace-desktop.png` and `screenshots/chatgpt-invoice-mobile-dark.png`. These show the official test host, not a connected ChatGPT account.

## Release acceptance still required

- Vercel migration/deployment READY and production discovery checks.
- User-approved OAuth connection of the saved private plugin.
- Real ChatGPT invoice discovery, resource mentions and native rendering.
- Enable the homepage launch card only after that host acceptance.

No customer invoice was issued, emailed or marked paid during validation. Public directory approval is outside private-plugin creation.
