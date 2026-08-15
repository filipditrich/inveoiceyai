# Launch readiness

This checklist is a release gate for opening Invoicey beyond the private beta.
It is intentionally separate from feature plans: an item here blocks a public
or paid launch even when the product build is otherwise green.

## Legal and commercial identity

- [ ] Confirm the legal operator name and legal form.
- [ ] Add the operator's IČO, registered address, and contact email to Privacy,
      Terms, and Cookies where applicable.
- [ ] Confirm the data-controller and processor wording with Czech/EU counsel.
- [ ] Define the commercial terms: plans, prices including/excluding VAT,
      billing interval, renewal, cancellation, refunds, and complaint process.
- [ ] Document subprocessors and international data transfers.
- [ ] Add effective dates and durable revision dates to all legal documents.
- [ ] Remove private-beta placeholder wording only after the facts above are
      approved.

The repository must not invent these facts. The owner supplies and approves
them before the legal-page copy is finalized.

## Deployment order

- [x] Back up the target database and record pre-migration row counts.
- [x] Apply `packages/db/sql/2026-08-13-default-issuer.sql`.
- [x] Apply `packages/db/sql/2026-08-13-issued-artifact-hashes.sql`.
- [ ] Apply Plan 22 payment SQL before enabling Fio in production:
      `2026-08-15-plan22-payments-fio.sql` (+ optional identifier backfill /
      auto-match follow-ups in `packages/db/sql/README.md`).
- [x] Run `bun run --cwd apps/web check:runtime-schema` against the target.
- [ ] Deploy the matching application commit only after the schema check passes.
- [ ] Repeat the authenticated smoke walkthrough and verify issued artifact
      hashes after deployment.

Completed against the configured Neon target on 2026-08-13. A custom-format
pre-migration backup was retained outside the repository; all recorded business
table row counts were unchanged after the idempotent migration run, and the
runtime schema compatibility check passed.

## Production controls

- [ ] Make the CI workflow a required branch-protection check.
- [ ] Review CSP reports, inventory required origins, then move from report-only
      to enforcement.
- [ ] Confirm HSTS at the production edge after every public hostname is HTTPS.
- [ ] Configure durable distributed rate limiting for public PDF previews; the
      in-process limiter is only a per-instance backstop.
- [ ] Connect structured error reporting with sensitive-field redaction.
