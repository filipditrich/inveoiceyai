# 0002: Next.js 15 with App Router, RSC, and Server Actions

## Status

Accepted (Phase 0, 2026-05-03)

## Context

The MVP web app needs:

- Authenticated-style pages with shared sidebar (forms-and-tables CRUD)
- Server-side data fetching from Neon Postgres
- Server-side mutations (creating invoices, etc.) with form-based UX
- Streaming binary responses for PDF and ISDOC downloads
- Future ARES proxy + UploadThing webhook routes
- Easy Vercel deploys

Framework options:

- **Next.js 15 App Router** — RSC, Server Actions, route handlers, all in one
- **Remix** — also great for forms-driven apps; smaller community of patterns we'd reuse
- **SvelteKit** — same idea, different ecosystem; we don't get shadcn/ReUI which our UI choice depends on (see [ADR 0003](./0003-shadcn-plus-reui-registry.md))
- **Vite + React + plain API routes** — viable but we'd reinvent RSC and Server Actions for free benefits we want

Within Next.js, App Router (vs. Pages Router):

- App Router is the future; Pages Router gets bug fixes only
- App Router supports RSC + Server Actions natively (Pages Router has neither)
- ReUI / shadcn examples ship App Router code

Patterns inside Next.js 15:

- **RSC** for read pages — zero client bundle for read-only views
- **Server Actions** for mutations — same form ergonomics as `<form>` POST, full Zod validation, no API route boilerplate
- **Route handlers** for binaries (PDF / ISDOC) and proxies (ARES, UploadThing) — Server Actions can't stream a `Uint8Array` cleanly

## Decision

`apps/web` is a **Next.js 15 App Router app** using:

- **RSC** as the default for every page in `(app)` route group; data is fetched directly inside the server component via `@invoicey/db`
- **Server Actions** as the _only_ mutation surface for app-level changes; each action parses input via the relevant Zod schema before touching the DB; same surface a future MCP tool will reuse
- **Route handlers** strictly for streaming binaries and proxying external APIs

`'use client'` is opt-in per component. Client components are kept small and focused (forms, modals, the data grid).

## Consequences

### Positive

- Read pages have minimal client-side JS — fast paint on data-heavy views like the data grid (which itself is a client component, but the surrounding shell isn't)
- Server Actions remove the need for a separate "API for the UI" — the UI calls TypeScript directly
- Route handlers are cleanly factored from mutations; not a grab-bag
- Vercel deploys Next.js trivially

### Negative

- The RSC mental model has sharp edges (cache, revalidation, fetch dedup) that take time to internalize
- Server Actions are opinionated — error handling, redirects, and revalidation patterns must follow the framework's conventions
- Some libraries (older form/UI libraries) don't play nicely with RSC; we mitigate by picking RHF (a client-side library) and shadcn/ReUI (which document RSC compatibility)

### Neutral

- We commit to React 19+ (App Router on Next.js 15 implies this); not an issue for our component choices
- We will need to disable Next.js image optimization for UploadThing-served images or configure `remotePatterns` properly — finalized in Plan 5

## Plans touched

- Plan 1 (bootstrap) — Next.js init, App Router skeleton, route group `(app)`
- Every later UI plan

## References

- [Next.js 15 docs](https://nextjs.org/docs)
- [Server Actions docs](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
