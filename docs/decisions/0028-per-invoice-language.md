# 0028: Per-invoice document language (cs | en)

## Status

Accepted (supersedes [0012](0012-czk-and-czech-only-mvp.md) for invoice language; [0026](0026-multi-currency-without-fx.md) still governs currency)

## Context

[ADR 0012](0012-czk-and-czech-only-mvp.md) locked `meta.language` to `cs` and hardcoded Czech PDF/ISDOC labels. The web UI already has `cs` / `en` via next-intl (`NEXT_LOCALE`, no URL prefix). Foreign clients need an English invoice document without dual-label bilingual PDFs.

UI locale and document language are independent: a Czech UI can issue an English PDF.

## Decision

- `InvoiceMetaSchema.language` is `z.enum(["cs", "en"])`.
- PDF, ISDOC generated notes / country names, and client-facing invoice emails (`invoice_sent`, `overdue_reminder`, `payment_received`) use **one** label set from `meta.language`.
- ISDOC `Note/@languageID` is set from `meta.language`. Import reads that attribute when present; otherwise `cs`.
- New drafts default to `cs` only when language is omitted (same pattern as currency → CZK).
- System emails (`workspace_invite`, `new_sign_in`) use the current request UI locale, default `cs`.
- Dual-label bilingual PDFs remain out of scope.

## Consequences

- Builder exposes a language picker next to currency.
- `@invoicey/invoice-core` owns document label maps (not next-intl).
- Existing Czech snapshots stay valid; English is additive.

## Plans touched

- invoice-core schema / PDF / ISDOC
- Web builder, AI / MCP / Eve drafts
- `@invoicey/emails`

## References

- [`invoice-schema.md`](../domain/invoice-schema.md)
- [`pdf-rendering.md`](../specs/pdf-rendering.md)
- [`email.md`](../specs/email.md)
