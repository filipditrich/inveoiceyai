# ChatGPT mobile follow-up — 2026-10-02

## Cause and fix

OpenAI marks imported plugins with bundled MCP declarations as desktop-only, including
remote HTTPS URLs. Invoicey 1.0.1 used this packaging. See
[OpenAI plugin management](https://learn.chatgpt.com/docs/enterprise/plugin-management).

Registered the existing hosted MCP endpoint as a ChatGPT app:
`asdk_app_6abf508edcc48191b06aed095e86da3b`. The original private plugin now references that
app through `.app.json`, with empty legacy/portable MCP declarations. Version 1.0.2, release
`pluginrel_6abf514c9c2c819192fa2984e13ae52b`. Read-back confirmed identity, audience, prompts,
skill and assets were retained.

The first real cloud registration failed because BotID rejected `/api/auth/oauth2/register`.
The auth route now delegates only register/token/introspect/revoke POST requests directly to
Better Auth, which applies OAuth validation and rate limits. Browser sign-in and consent
remain BotID-protected. Exact path matching avoids exempting unrelated routes.

## Evidence

- Regression tests failed before the fix: registration returned 403 and three machine routes
  called the browser check. All eight route tests now pass with a real in-memory Better Auth
  provider, including rejection of invalid credentials and protection of browser/near-match routes.
- All 425 web tests, focused lint and all ten package typechecks passed.
- Production deployment `dpl_2SZLCDNL2S8ozYFyaoUxW7J9aFin` reached READY and was aliased to
  `https://invoicey.app`; fix committed to main as `a88ff51`.
- Retrying through ChatGPT successfully registered the app and reached **Connect Invoicey**.
  OAuth discovery selected DCR and found the intended scopes and endpoints.
- Original plugin listing now shows **Try in chat**, **Apps 1**, **Skills 1**, and version
  **1.0.2** in the real ChatGPT web host. Previously it showed **Open in desktop app**.
- `screenshots/chatgpt-cloud-listing-phone-width.png` records the real listing at 390 px.
  This is browser evidence, not an iOS/Android app test.

## Pending user consent and mobile acceptance

The connection prompt is left open for the user. No Invoicey workspace grant was approved
by the agent. After consent, verify read-only invoice discovery, detail rendering and
artifacts in ChatGPT, then exercise native mobile flows. Confirm writes only against an
explicitly disposable test invoice. Keep the homepage launch gate disabled until acceptance.
