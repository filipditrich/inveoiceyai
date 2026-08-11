# Implementation plans

Plans complement [`docs/roadmap.md`](../docs/roadmap.md): roadmap owns phase goals and exit **criteria** (checkbox ledger); files here capture narrative ordering and execution notes.

| File                                                                 | Maps to                                      |
| -------------------------------------------------------------------- | -------------------------------------------- |
| [`plan-01-bootstrap.md`](./plan-01-bootstrap.md)                     | Plan 1 — repo bootstrap                      |
| [`plan-02-invoice-core.md`](./plan-02-invoice-core.md)               | Plan 2 — `invoice-core` domain package       |
| [`plan-03-pdf-qr-isdoc.md`](./plan-03-pdf-qr-isdoc.md)               | Plan 3 — PDF + QR + ISDOC rendering          |
| [`plan-11a-email-engine.md`](./plan-11a-email-engine.md)             | Plan 11a — Email engine (Resend + templates) |
| [`plan-11b-invoice-send.md`](./plan-11b-invoice-send.md)             | Plan 11b — Invoice send UI + timeline        |
| [`plan-11c-email-agents.md`](./plan-11c-email-agents.md)             | Plan 11c — MCP / Eve send tools              |
| [`plan-11d-email-lifecycle.md`](./plan-11d-email-lifecycle.md)       | Plan 11d — Reminders + suppression           |
| [`plan-12-mcp-local.md`](./plan-12-mcp-local.md)                     | Plan 12a — MCP local + Vercel HTTP prep      |
| [`plan-13-slack-bot-stateless.md`](./plan-13-slack-bot-stateless.md) | Plan 13a — Slack bot (stateless demo)        |
| [`plan-16-account-security.md`](./plan-16-account-security.md)       | Plan 16 — Account security & settings        |
| [`plan-18-platform-admin.md`](./plan-18-platform-admin.md)           | Plan 18 — Global platform admin              |

**Naming:** `plan-NN-short-slug.md` matching roadmap Plan N. When a roadmap phase splits into sub-phases (e.g. 13a / 13b), the file name keeps the parent number and the slug disambiguates.

When completing a phase: tick criteria in `docs/roadmap.md`, set **Status** to Done with completion date, and optionally archive lengthy scratch notes here (short appendix only).
