# Incoming invoices — operator setup and validation

This is what Invoicey cannot do for you. The product code for Plan 24 is in
the repo; capture, payment tokens, and DNS are account-side.

## 1. Apply the schema

On every environment (local, preview, production):

```bash
psql "$DATABASE_URL" -f packages/db/sql/2026-08-16-plan24-incoming-invoices.sql
bun run --cwd packages/db scripts/row-counts.ts
bun run --cwd apps/web check:runtime-schema
```

Do **not** run unattended `bun db:push` against a populated database.

Optional local seed so `/incoming-invoices` is not empty:

```bash
bun run --cwd packages/db scripts/seed-incoming-invoices.ts
```

## 2. Environment variables

Set these in addition to the existing Invoicey env (see `.env.example`):

| Variable                                | Required           | What it is                                                                    |
| --------------------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| `INVOICEY_INBOUND_EMAIL_DOMAIN`         | for mail capture   | Receiving domain, e.g. `inbox.invoicey.ditrich.me`                            |
| `RESEND_INBOUND_WEBHOOK_SECRET`         | for mail capture   | Svix secret of the **inbound** webhook. Distinct from `RESEND_WEBHOOK_SECRET` |
| `RESEND_API_KEY`                        | for mail capture   | Same key as delivery; used to fetch body + attachments after `email.received` |
| `INVOICEY_INBOUND_MAX_ATTACHMENT_BYTES` | optional           | Default 20 MiB                                                                |
| `INVOICEY_INBOUND_MAX_MESSAGES_PER_DAY` | optional           | Default 200 per workspace                                                     |
| `INVOICEY_AI_EXTRACT_MODEL`             | for PDF extraction | Document-capable AI Gateway model. Separate from `INVOICEY_AI_MODEL`          |
| `AI_GATEWAY_API_KEY`                    | for PDF extraction | Already used by Eve; extraction skips when unset                              |
| `INVOICEY_AGENT_LOGIN_SECRET`           | local/agent only   | Min 16 chars. Unset disables `/agent-login`                                   |
| `BANK_TOKEN_ENCRYPTION_KEY_V1`          | for Fio submit     | Already required for read-only bank sync                                      |

## 3. Resend Inbound (mail capture)

1. Confirm Resend Inbound is enabled on the account.
2. Add receiving domain `inbox.invoicey.ditrich.me` (or the value of `INVOICEY_INBOUND_EMAIL_DOMAIN`).
3. DNS — MX on that **subdomain** only, priority 10, lowest on the name. Leave the apex mail setup alone.
4. Create an `email.received` webhook pointing at `https://<app>/api/webhooks/resend-inbound`.
5. Put the webhook signing secret in `RESEND_INBOUND_WEBHOOK_SECRET`.
6. Privacy policy / processor list must mention inbound content.

Validation: send a PDF or ISDOC to the workspace alias shown in
Settings → Incoming invoices. The webhook must return 200 quickly; the ingest
job fetches attachments over the Resend API. Cron `/api/cron/inbound-ingest`
sweeps items stuck in `received` / `processing`.

The alias is a bearer capability. Rotating it deactivates the old address
immediately.

## 4. Fio submit token (payment runs)

Invoicey never authorizes a payment. A submit-rights token only places a batch
in Fio's orders-to-sign queue.

1. The account holder creates a **second** API token with submit rights
   (not the read-only monitoring token).
2. Paste it in Settings → Bank connections → Payment initiation.
3. Set the expiry the user sees in Fio (tokens cap at 180 days).
4. A new beneficiary account must be confirmed on the supplier before it can
   enter a run.

Pilot gate from the plan: one small real payment, authorized in Fio by the
account owner, before anyone else may enter a submit token. Keep payable
auto-confirmation off through the pilot.

## 5. Agent login (browser review)

Product auth stays OAuth-only (ADR 0018). `/agent-login` exists so an automated
browser can open the app:

1. Set `INVOICEY_AGENT_LOGIN_SECRET` (min 16 characters).
2. Open `/agent-login`, enter the secret.
3. Invoicey creates `agent@invoicey.local` if needed, adds them as owner of the
   first workspace, and issues a Better Auth session cookie.

## 6. What to click through after deploy

- `/incoming-invoices` — review / approve / pay tabs
- `/incoming-invoices/upload` — PDF or ISDOC
- `/incoming-invoices/inbox` — raw mail and parked non-invoices
- `/incoming-invoices/runs` — confirm, submit, “waiting for authorization”
- `/suppliers` — confirm a new beneficiary account
- Settings → Incoming invoices — alias + approval rules
- Settings → Bank connections — submit token, “Invoicey cannot authorize”

Nothing in the product should read “paid” or “sent” between Fio submit and a
matched debit.
