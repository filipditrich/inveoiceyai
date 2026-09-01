# Architectural Decision Records

ADRs for Invoicey. Append-only, numbered. Format is [Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

When a decision changes:

1. Write a new ADR with the next number
2. Set the new ADR's `Status` to `Accepted (supersedes 00XX)`
3. Edit the old ADR's `Status` to `Superseded by 00YY`
4. Never rewrite the body of a superseded ADR

## Index

| #                                                          | Title                                                      | Status                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| [0001](./0001-monorepo-turborepo-bun.md)                   | Monorepo with Turborepo + bun workspaces                   | Accepted                                 |
| [0002](./0002-nextjs15-app-router.md)                      | Next.js 15 with App Router, RSC, Server Actions            | Accepted                                 |
| [0003](./0003-shadcn-plus-reui-registry.md)                | shadcn/ui base + ReUI registry                             | Accepted                                 |
| [0004](./0004-pdf-react-pdf-renderer.md)                   | PDF rendering via @react-pdf/renderer                      | Accepted                                 |
| [0005](./0005-zod-as-source-of-truth.md)                   | Zod as the single source of truth for the invoice contract | Accepted                                 |
| [0006](./0006-no-auth-mvp-multi-tenant-ready.md)           | No auth in MVP, multi-tenant-ready schema                  | Superseded in part by 0018               |
| [0007](./0007-workspace-scoped-data-model.md)              | Workspace-scoped data model (`workspace_id` everywhere)    | Accepted                                 |
| [0008](./0008-snapshot-issuer-client-at-issue-time.md)     | Snapshot issuer + client at issue time                     | Accepted                                 |
| [0009](./0009-drizzle-neon-postgres.md)                    | Drizzle ORM + Neon Postgres                                | Accepted                                 |
| [0010](./0010-uploadthing-for-files.md)                    | UploadThing for file uploads                               | Accepted                                 |
| [0011](./0011-full-czech-vat-from-day-one.md)              | Full Czech VAT compliance from day one                     | Accepted                                 |
| [0012](./0012-czk-and-czech-only-mvp.md)                   | CZK + Czech-only invoices in MVP                           | Superseded in part by 0026 + 0028        |
| [0013](./0013-configurable-per-issuer-numbering.md)        | Configurable per-issuer numbering schemes                  | Accepted                                 |
| [0014](./0014-status-derived-not-stored.md)                | Invoice status is derived, not stored                      | Accepted                                 |
| [0015](./0015-rhf-plus-zod-resolver-builder.md)            | RHF + zodResolver for the invoice builder                  | Accepted                                 |
| [0016](./0016-server-actions-as-mutation-surface.md)       | Server Actions as the only mutation surface                | Accepted                                 |
| [0017](./0017-tailwind-v4-tooling-baseline.md)             | Tailwind CSS v4 tooling baseline for web app               | Accepted (formatting superseded by 0040) |
| [0018](./0018-better-auth-oauth-only.md)                   | Better Auth, OAuth-only (no Clerk, no passwords)           | Accepted                                 |
| [0019](./0019-workspaces-are-better-auth-organizations.md) | Workspaces are Better Auth organizations                   | Accepted                                 |
| [0020](./0020-slack-identity-linking.md)                   | Explicit Slack identity linking (no email match)           | Accepted                                 |
| [0021](./0021-immutable-imported-invoice-artifacts.md)     | Immutable imported invoice artifacts + provenance          | Accepted                                 |
| [0022](./0022-resend-and-react-email.md)                   | Resend + react-email for transactional mail                | Accepted                                 |
| [0023](./0023-account-security-soft-devices.md)            | Soft trusted devices + PAT cutover for machine auth        | Accepted                                 |
| [0024](./0024-platform-admin-user-flag.md)                 | Platform admin is a user flag, not a workspace role        | Accepted                                 |
| [0025](./0025-referral-attribution.md)                     | Referral links are signup attribution only                 | Accepted                                 |
| [0026](./0026-workspace-ai-tokens.md)                      | Workspace AI tokens as entitlement unit                    | Accepted                                 |
| [0026](./0026-multi-currency-without-fx.md)                | Multi-currency invoices without FX                         | Accepted                                 |
| [0027](./0027-recurring-drafts-only.md)                    | Recurring schedules materialize drafts only                | Accepted                                 |
| [0028](./0028-per-invoice-language.md)                     | Per-invoice document language (`cs` \| `en`)               | Accepted                                 |
| [0029](./0029-payment-ledger-fio-first.md)                 | Provider-neutral payment ledger with Fio first             | Accepted                                 |
| [0030](./0030-moneta-second-adapter.md)                    | MONETA as second read-only bank adapter                    | Accepted                                 |
| [0034](./0034-email-transport-adapters.md)                 | Provider-neutral email transport with Resend first         | Accepted                                 |
| [0035](./0035-plans-are-shared-entitlement-rows.md)        | Plans are shared entitlement rows, not per-workspace flags | Accepted                                 |
| [0036](./0036-managed-client-catalogs.md)                  | Managed client catalogs sync into workspaces               | Accepted                                 |
| [0037](./0037-declarative-token-grants.md)                 | Token grants are declarative rules on one ledger           | Accepted                                 |
| [0038](./0038-permission-catalog-with-role-presets.md)     | Permission catalog with role presets + member overrides    | Accepted                                 |
| [0039](./0039-looks-are-data-react-pdf-interprets.md)      | Invoice PDFs are looks (data, react-pdf interprets)        | Accepted                                 |
| [0040](./0040-oxc-toolchain.md)                            | oxlint + oxfmt (anti-slop, complexity)                     | Accepted                                 |
