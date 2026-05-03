# 0005: Zod as the single source of truth for the invoice contract

## Status

Accepted (Phase 0, 2026-05-03)

## Context

Multiple surfaces need to produce or consume invoices:

- The Next.js builder UI (Plan 6) — needs a validator for RHF
- The server actions for create / issue / mark-paid (Plan 6) — needs to validate incoming payloads before touching the DB
- The PDF renderer (Plan 3) — needs typed inputs to render reliably
- The ISDOC generator (Plan 3) — same
- A future MCP tool (Plan 12) — exposes "create invoice" as a callable tool
- A future Slack bot (Plan 13) — parses unstructured text into a structured invoice
- Future webhook payloads — incoming invoice data from third-party tools

If each surface had its own type definition, they'd drift. The drift is silent and only surfaces when an invoice fails to render or fails to validate at the wrong layer.

Options for the canonical contract:

1. **Zod schema** — runtime + compile-time types from one source. Has `.parse`, `.safeParse`, `.refine`, error reporting. Runtime cost is low. We're already using it for environment validation patterns and form resolvers.
2. **TypeScript-only types + manual runtime validators** — duplicate maintenance.
3. **JSON Schema + JSON-Schema-derived TypeScript types via `json-schema-to-typescript`** — interoperable with non-TS clients but loses runtime ergonomics.
4. **Protobuf / OpenAPI** — overkill for an internal contract that doesn't go over the wire.

Forces:

- Same shape must validate at the form (client) layer, the server action layer, the MCP layer, and (eventually) at incoming-webhook layers
- Errors should be field-precise; Zod's structured errors integrate cleanly with RHF
- The author already prefers Zod (per `.cursor/rules/typescript-best-practices.mdc` patterns and ecosystem norms)

## Decision

`InvoiceSchema` (and its descendants `IssuerSnapshotSchema`, `ClientSnapshotSchema`, `InvoiceItemSchema`, `TotalsSchema`, `InvoiceMetaSchema`, `InvoiceVatSchema`, `PaymentSchema`) is defined as **Zod schemas** in `packages/invoice-core/src/schema.ts`. They are the single source of truth.

Concrete usage rules:

- The form layer (RHF) uses `zodResolver(InvoiceSchema)` (see [ADR 0015](./0015-rhf-plus-zod-resolver-builder.md))
- Every server action calls `Schema.parse` (or `safeParse` for user-facing errors) **first**, before any DB call
- The PDF and ISDOC renderers consume `z.infer<typeof InvoiceSchema>` (= `Invoice`) and treat it as already-validated; no re-validation
- Future MCP tools wrap `Schema.parse` for tool-input validation
- DB Drizzle types and Zod types are kept in sync manually in MVP; we do not auto-generate one from the other

## Consequences

### Positive

- Drift between layers becomes mechanical to detect — same schema is the gate everywhere
- Errors surface at the layer they should (RHF for client errors, server-action exceptions for malicious / out-of-band payloads)
- The MCP / Slack rollouts (Plans 12, 13) become trivial: parse the input → call the same server action
- Refinements (cross-field rules — e.g. credit-note must reference an original) are colocated with the schema

### Negative

- Zod adds ~14 KB gzipped to the client bundle for the parts of the schema imported by client components. Mitigated by tree-shaking; for the bits the form actually uses this is tiny.
- Schema migrations require versioning thinking (when an old `payload_json` was stored under a previous shape). We mitigate by making new fields optional and adding `.default(…)` where sensible.
- Zod 3 vs Zod 4: as of 2026-05 we standardize on whatever Zod ships in `node_modules` at Plan 1 init (likely Zod 4.x). Lock the version in the workspace root.

### Neutral

- We get free TypeScript types via `z.infer<typeof X>` — never write parallel types that could drift
- We do not export `JSONSchema` representations from the Zod schemas in MVP. If a future webhook or MCP-tool description needs JSON Schema, we'll generate it via `zod-to-json-schema` then.

## Plans touched

- Plan 2 (`invoice-core` domain) — primary implementation
- Every later plan that consumes or produces an invoice

## References

- [Zod](https://zod.dev)
- [`@hookform/resolvers/zod`](https://react-hook-form.com/get-started#schemavalidation)
