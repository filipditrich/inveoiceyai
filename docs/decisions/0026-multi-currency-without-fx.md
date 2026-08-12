# 0026: Multi-currency invoices without FX

## Status

Accepted (2026-08-12)

## Context

[ADR 0012](0012-czk-and-czech-only-mvp.md) locked `currency` to `CZK` for MVP. Product now needs EUR/USD invoices for foreign clients without CNB rate conversion yet.

## Decision

- `InvoiceMetaSchema.currency` is `z.enum(["CZK", "EUR", "USD"])`.
- Invoice language is independent of currency; see [ADR 0028](0028-per-invoice-language.md) (`cs` | `en`).
- No exchange-rate fetch or snapshot in this pass (`CurrRate` stays `1`; no `ForeignCurrencyCode`).
- SPAYD / payment QR is emitted **only** when `currency === "CZK"`.
- Dashboard aggregates amounts **per currency** (never sum mixed codes into one pile). Monthly chart remains CZK-only.

## Consequences

- Builder exposes a currency picker; PDF uses `currencyDisplaySuffix`.
- AI / MCP / import may supply `meta.currency`; default remains `CZK`.
- Full FX (CNB + ISDOC foreign currency) remains a follow-up. Dual-label bilingual PDFs remain out of scope (0028).
