# Seamless first-use and invoice-lifecycle UX pass

This specification implements the decisions made from the historical [current user-flow audit](../audit/invoicey-current-user-flow.md). The audit remains descriptive evidence, not a requirements document.

Focused browser checks are indexed in the [seamless UX evidence](../audit/improvements/README.md).

## UX principles

- Describe the user’s own issuer as a business: **My businesses** / **Moje firmy**. Keep supplier terminology for the legal supplier party on an invoice and for incoming suppliers.
- Make the first issued invoice the activation goal. A structured form remains the primary creation path; AI is an assisted alternative with validation feedback.
- Preserve the invoice lifecycle as accounting history: cancellation is permanent, retains the invoice number, and is blocked by active payment allocations.
- Keep generated and stored issued PDFs viewable in the app without reducing framing protections for ordinary pages or attachment downloads.

## Implemented decisions

- The welcome flow visually states Business, Bank account, and Ready; it leads with ARES by IČO and presents embedded-ISDOC PDF import as a non-OCR alternative.
- Bank account setup explains its invoice/QR purpose and that Invoicey does not move money. Skipping remains possible but explains the issuance prerequisite.
- A workspace with a business and no invoices receives a focused dashboard surface with structured and AI creation routes. Normal dashboard metrics remain once any invoice exists.
- Invoice detail uses a confirmation sheet for cancellation. It links to the localized payment ledger when allocations block cancellation; cancellation and allocation both serialize on the invoice row lock, so the server action remains race-safe.
- Invoice payment states, sources, reversals, amounts, and dates are localized. Lists no longer expose raw partial/overpaid enum values.
- The PDF endpoint applies same-origin-only framing headers solely to `?disposition=inline`; downloads remain attachment responses without those relaxed headers.
- The AI prompt includes compact guidance and direct client/form routes for follow-up work.

## Acceptance criteria

- New users can create a business through ARES, complete required contact/bank data, and reach **Create first invoice**.
- A user with a business and zero invoices sees creation guidance, not empty metrics.
- Cancellation is never immediate from a detail action; invoices with active payments cannot submit it, and server-side cancellation failures return to the same detail route with an actionable localized message. Cancellation cannot commit alongside an active payment allocation.
- Issued PDFs render inline from generated and proxied storage paths only under same-origin framing policy.
- English and Czech catalogs include all changed visible strings.

## Verification

Completed from repository root:

```sh
bunx prettier --write <owned changed files>
bunx prettier --check <owned changed files>
bun --cwd apps/web vitest run lib/serve-invoice-file.test.ts
bun run typecheck
bun run lint
bun run test
bun run build
git diff --check
```

Results: the targeted PDF suite passed 3/3 tests; typecheck passed 9/9 Turbo tasks; lint completed with 0 errors and 12 pre-existing warnings; tests passed 7/7 Turbo tasks, including 113 web tests; and `git diff --check` was clean. Browser verification covers payment-blocked cancellation with inline PDF, AI guidance, localized partial-payment list safety, onboarding completion, and the ARES-first entry path; see the [evidence index](../audit/improvements/README.md).

The production build is environment-blocked: even after an escalated retry, Turbopack failed with a port-bind `EPERM` in unchanged `apps/web/lib/docs-source.ts`. No feature compilation error was reported.

## Deferred work

This pass does not send invoice email, create API keys, connect bank or Slack accounts, mutate production data, or alter incoming-invoice approval and payment-execution flows.
