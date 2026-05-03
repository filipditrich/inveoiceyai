# Implementation plans

Plans complement [`docs/roadmap.md`](../docs/roadmap.md): roadmap owns phase goals and exit **criteria** (checkbox ledger); files here capture narrative ordering and execution notes.

| File                                                                 | Maps to                                |
| -------------------------------------------------------------------- | -------------------------------------- |
| [`plan-01-bootstrap.md`](./plan-01-bootstrap.md)                     | Plan 1 — repo bootstrap                |
| [`plan-02-invoice-core.md`](./plan-02-invoice-core.md)               | Plan 2 — `invoice-core` domain package |
| [`plan-03-pdf-qr-isdoc.md`](./plan-03-pdf-qr-isdoc.md)               | Plan 3 — PDF + QR + ISDOC rendering    |
| [`plan-13-slack-bot-stateless.md`](./plan-13-slack-bot-stateless.md) | Plan 13a — Slack bot (stateless demo)  |

**Naming:** `plan-NN-short-slug.md` matching roadmap Plan N. When a roadmap phase splits into sub-phases (e.g. 13a / 13b), the file name keeps the parent number and the slug disambiguates.

When completing a phase: tick criteria in `docs/roadmap.md`, set **Status** to Done with completion date, and optionally archive lengthy scratch notes here (short appendix only).
