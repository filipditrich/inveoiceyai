---
name: create-czech-invoice
description: Step-by-step Czech invoice creation via ARES, draft render, Slack upload, and HITL issue/paid.
---

# Create a Czech invoice

1. Collect client IČO or company name, line items with amounts, due date, and currency (CZK default).
2. Resolve client from ARES:
   - Name only → `search_business`; if several hits, ask the user to pick (`Name (IČO) — address`).
   - Then `lookup_business` with the IČO (or reuse `match.address` when present).
   - Never invent street / city / ZIP / country.
3. `create_invoice` with a **complete** partial draft (tool schema rejects empty/partial bags). Issuer is locked server-side. Required:
   - `meta`, `client`, `vat`, `payment`, `items`
   - `client.address` must be `{ street, city, zip, country: "CZ" }`
   - `vat` is a **top-level object** (not line `vatRate`): `{ mode, suppliesAbroad }`
     - Domestic CZ: `{ "mode": "regular", "suppliesAbroad": "none" }`
     - `mode`: `regular` | `reverse_charge` | `oss`
     - `suppliesAbroad`: `none` | `eu` | `non_eu`
   - Each item needs `description`, `quantity`, `unit`, `unitPriceWithoutVat`, `vatRate` (e.g. `21`). `position` is optional.
   - If amounts are spoken/quoted **including** VAT, set `pricesIncludeVat: true`.
   - Never invent `legalNote` / `localReverseChargeCode`; reverse charge without a code fails.
   - Do not retry `create_invoice` to discover required fields — fill the schema or ask.
4. Slack auto-uploads PDF/ISDOC from `create_invoice`. Call `upload_invoice_files` only if that did not happen.
5. Keep the reply short — Slack posts a structured Card + **View in Invoicey**; do not repeat those fields in prose.
6. When they ask to issue: `issue_invoice` → wait for Allow/Deny → re-upload if needed.
7. When they ask to mark paid: `mark_invoice_paid` → wait for Allow/Deny.
8. When they ask to email the invoice: `send_invoice_email` → wait for Allow/Deny. Pass `to` if the client has no `contactEmail`.
