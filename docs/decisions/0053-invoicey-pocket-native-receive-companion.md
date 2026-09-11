# 0053: Invoicey Pocket is a native receive-only iPhone companion

## Status

Accepted

## Context

Invoicey's web payment-request loop already creates SPAYD payment facts and
watches Fio/MONETA reconciliation. A person collecting money face to face needs
a faster, focused surface with a large QR, live feedback, sharing, and native
notifications. Reimplementing bank access or matching on the phone would split
financial authority and make background execution unreliable.

## Decision

- Build `Invoicey Pocket` as a separate native SwiftUI iOS app.
- The app is receive-only: amount or collectible invoice in, QR/link out, then
  wait for server-confirmed settlement.
- Invoicey's ledger, bank adapters, matching, and status remain authoritative.
  The phone never talks to a bank and never declares payment from proximity or
  payer interaction.
- Pair through interactive Invoicey web sign-in, a five-minute single-use PKCE
  grant, and a device bearer token stored in Keychain. Each device is pinned to
  one workspace and permissions are re-evaluated on every operation.
- Use one compact JSON command endpoint for the companion. It exposes only the
  Pocket operations in the spec and always scopes by the paired device.
- Nearby discovery, NFC/Bluetooth, payment initiation, and payer-side software
  are outside phase one.

## Consequences

The app can ship independently while reusing the existing trustworthy payment
loop. A working bank connection is required for collection. Changing workspace
requires pairing again, which is intentional for the first security model.

## References

- [Invoicey Pocket spec](../specs/invoicey-pocket.md)
- [Payment requests spec](../specs/payment-requests.md)
- [ADR 0052](./0052-durable-notification-outbox.md)
