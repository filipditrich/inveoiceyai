# ChatGPT launch preparation — 2 October 2026

## Verified in the real host

The user's ChatGPT conversation showed a successful invoice list and creation of an interactive 1 CZK draft. The invalid seven-digit IČO was clarified before the corrected draft request. No invoice was issued, emailed or marked paid by this release check.

The standalone app worked. Earlier requests selecting the optional 1.0.2 workflow package reported unavailable tools. The previous recommendation to prefer that package was premature. The public guide now directs users to create/select the connected app itself.

The private package is now **Invoicey workflows 1.0.3**, preserving its ID and audience. Its instructions explain the direct-app fallback. Source read-back confirmed the release. This is a naming/recovery improvement, not proof that the wrapper's tool routing was fixed.

OpenAI's package guide currently describes `plugin_asdk_app…` IDs, but Plugin Creator rejects those and requires `asdk_app_`, `connector_` or `templated_apps_`. The accepted existing binding was preserved. Do not repeat the rejected ID migration without a changed platform contract.

The host displayed “CSP off” during the initial inspection. A production-policy run with CSP enforced, native iOS/Android acceptance and the remaining write confirmations are not claimed verified.

## Distribution

- Today: custom MCP app setup for eligible ChatGPT accounts. Each user creates/connects their app against `https://invoicey.app/api/mcp` and authorizes their own workspace. Organization access may require an administrator.
- The private plugin is not a public installation link. Do not place it behind a public “Install” CTA.
- Public directory: complete publisher/review preparation, submit to OpenAI, then publish after approval. Hosting the MCP endpoint does not perform those steps.
- Public homepage and `/chatgpt` describe the forthcoming **public release**, with the intended one-click connection flow in Czech/English. Developer-mode setup remains in the tester documentation only. They do not promise native mobile access or public-directory approval.

## Public review candidate

Run `python3 scripts/package-chatgpt-submission.py`. It creates `dist/invoicey-public-review-candidate.zip` from the existing source, preserves the private source and replaces account bindings with the hosted MCP endpoint. It includes five positive and three negative review cases. No credentials or private invoice screenshots are included.

Readiness gaps:

- Owner confirmed the individual publisher: **Ing. Filip Ditrich**. Package author/developer name is populated; portal identity verification remains outstanding.
- Owner confirmed **Czechia only** (`CZ`) and **no buying or payments through the integration**. Country targeting is populated. The package declares `review.commerce: false`; invoice payment recording is bookkeeping, not payment processing.
- Owner confirmed support contact **filip@ditrich.me**. A public support page on invoicey.app still needs to be published and verified before adding its URL to the package.
- Published privacy/terms currently defer operator identity/contact and retention details. Owner must resolve those statements before public launch. ChatGPT-specific sharing should be covered in the final policy.
- A real, reviewer-accessible recorded demo using a dedicated sample workspace.
- Secure reviewer access independent of the owner's mailbox/MFA.
- Public portal validation, domain/developer verification and owner-completed attestations.

The ZIP is a preparation candidate, **not submission-ready**. Positive list/draft behavior was observed in the user's live conversation; the complete eight-case reviewer sequence has not been run. Negative cases and draft-update case remain not run. No public upload or submission was made.

References: [Package guide](https://developers.openai.com/plugins/build/plugins), [submission](https://developers.openai.com/plugins/deploy/submission), [custom-app access](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt).
