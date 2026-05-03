# 0016: Server Actions as the only mutation surface

## Status

Accepted (Phase 0, 2026-05-03)

## Context

Mutations in `apps/web` could be implemented as:

1. **Server Actions** — Next.js 15's first-class form-/RPC-style API; called via `<form action={…}>` or `useTransition`
2. **Route handlers (`/api/*`) called from `fetch`** — classic JSON API; one route per mutation
3. **Mixed** — Server Actions for some, route handlers for others

We also need to consider future surfaces:

- A future MCP tool (Plan 12) that performs the same mutations programmatically
- A future Slack bot (Plan 13) that performs them on user instruction
- A future REST API (maybe never, maybe Plan 15) for third-party clients

Forces:

- Server Actions get RSC's revalidation + cookie/auth/redirect ergonomics for free
- Route handlers force us to roll our own request validation, error responses, revalidation, redirects
- Server Actions cannot stream binaries (so PDF/ISDOC must be route handlers)
- We want the *same* validated payload to be processable by UI, MCP, and Slack — so the validation code must be reusable, not embedded in a route handler

## Decision

All app-level **mutations** in `apps/web` are implemented as **Server Actions** living in `apps/web/actions/`. They are organized by entity:

- `actions/invoices.ts` — `createDraft`, `updateDraft`, `issueInvoice`, `markPaid`, `unmarkPaid`, `cancelInvoice`, `deleteDraft`, `duplicate`
- `actions/issuers.ts` — `createIssuer`, `updateIssuer`, `deleteIssuer`, `updateNumberingScheme`
- `actions/clients.ts` — `createClient`, `updateClient`, `deleteClient`, `lookupAresAndUpsert`

Each action:

1. Takes an input object that's parsed by the relevant Zod schema **first thing**
2. Performs the DB work in a transaction where appropriate
3. Calls `revalidatePath` / `revalidateTag` to propagate changes to RSC pages
4. Returns a typed result (`{ ok: true, data: … }` / `{ ok: false, error: … }`) that callers can branch on

**Route handlers** are reserved for:

- Streaming binaries: `/api/invoices/[id]/pdf` and `/api/invoices/[id]/isdoc`
- External-API proxies: `/api/ares/[ico]` (caches via `unstable_cache`)
- UploadThing: `/api/uploadthing` (its own framework convention)

For Plans 12 (MCP) and 13 (Slack), the apps **import the server-action functions directly** from `apps/web/actions/`. This works because:

- The action functions are plain async functions when called outside a `'use server'` form-binding context
- They contain the same Zod-validated, DB-transactional, revalidation logic the UI calls
- Schema parity is automatic — both UI and MCP/Slack consume the same input types

If direct import becomes architecturally awkward (cross-app coupling), we can extract the action bodies into `packages/invoice-core/src/operations/*.ts` and have both `apps/web` and `apps/mcp` import from there. The decision to do that lands in Plan 12, not now.

## Consequences

### Positive

- One mutation surface; no parallel REST API to maintain
- Zod validation runs in exactly one place per mutation
- RSC cache invalidation is one `revalidatePath` away
- MCP / Slack consume the same logic — schema parity is mechanical, not enforced by hand
- Form ergonomics (progressive enhancement, free `<form action={…}>`) come for free

### Negative

- Server Actions can't stream binaries (PDF / ISDOC) — split surface into Actions + route handlers, with discipline about what goes where
- Cross-app imports (`apps/mcp` importing from `apps/web/actions/`) couple the two more tightly than a JSON API would. We accept this until it hurts.
- Server Actions have specific debugging quirks (the request payload format is implementation-defined); developer tooling exists but is less mature than for REST APIs

### Neutral

- We do not use tRPC. It would be a third valid choice; Server Actions cover the same ergonomics with less infrastructure. If we ever expose a public API, tRPC is a candidate, not Server Actions.
- The route-handler vs. server-action split is a *thinking* exercise on every new endpoint: "is this a mutation triggered by a user action? → Server Action. Is this a binary stream or a proxy? → route handler."

## Plans touched

- Plan 4–9 — every mutation introduced lives in `actions/`
- Plan 12 (MCP) — direct imports from `apps/web/actions/` (or extract to `invoice-core/operations` if needed)
- Plan 13 (Slack) — same

## References

- [Next.js Server Actions docs](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [`architecture.md`](../architecture.md) — runtime boundaries diagram
