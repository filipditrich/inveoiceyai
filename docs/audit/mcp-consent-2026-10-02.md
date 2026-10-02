# OAuth consent regression — 2 October 2026

## Failure and correction

Production consent POSTs threw Better Auth `APIError: request not found` (401, surfaced as a Next server-action 500). A bare consent URL could also submit an empty query and throw `missing oauth query`.

The server actions supplied `headers` and `body` but no `Request`. Better Auth 1.6.26 requires that request when consent or login continuation resumes authorization. The actions now supply it, request a JSON redirect result, and explicitly disable automatic Response conversion. Without the latter, adding only a Request stopped the exception but left the browser on consent.

Expected provider 4xx failures now redirect to a localized restart page. Missing/expired links cannot render the submit form. Query signatures and callback validation remain the provider's responsibility; the action never redirects directly to a submitted callback. Unexpected server failures still propagate. Denial does not require selecting a workspace.

## Browser evidence

`bun run --cwd apps/web test:oauth` launches a separate Next application with the **production page and server actions**, the actual Better Auth OAuth provider, production OAuth options, and in-memory accounts/token storage. Workspace membership is isolated to two test workspaces. Password sign-up exists only in this test application, outside the production route tree. Registration throttling is disabled only in that isolated host.

The original action reproduced the production `request not found` exception in this browser test. After correction, all 12 cases passed: six scenarios in desktop Chromium and mobile Chromium (Pixel 7 emulation).

- Allow: select the second workspace, submit the form, receive callback state/code, exchange with PKCE, verify the access token signature/issuer/audience and selected workspace, refresh and verify workspace retention.
- Deny: callback reports `access_denied`, preserves state and contains no code.
- Login continuation: a provider-signed login URL resumes through the real continue action to consent and authorization callback.
- Bare consent link: recovery page instead of a broken form.
- Tampered callback in signed query: no external redirect, no 500, recovery page.
- Expired link: recovery page without a submit button.

Full Turbo tests passed (including 425 web tests); monorepo typechecks passed. Focused lint and isolated-host typechecks are also required before release.

These tests prove Invoicey's browser/server OAuth integration. They do not substitute for final authorization of a real workspace in ChatGPT or native iOS/Android acceptance. Production ChatGPT authorization requires the account owner's consent; public launch remains gated pending that acceptance.
