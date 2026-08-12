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
3. `create_invoice` with a partial draft. Issuer is locked server-side. Required draft fields:
   - `meta`, `client`, `payment`, `items`
   - VAT intent: top-level `vat` **or** `vatPreset` (`neplatce` | `regular` | `reverse_charge` | `oss`)
   - `client.address` must be `{ street, city, zip, country: "CZ" }`
   - `vat` is a **top-level object** (not line `vatRate`): `{ mode, suppliesAbroad }`
     - Domestic CZ default: `{ "mode": "regular", "suppliesAbroad": "none" }`
     - `mode`: `regular` | `reverse_charge` | `oss`
     - `suppliesAbroad`: `none` | `eu` | `non_eu`
   - If `vat` is omitted, `vatPreset` invents `{ mode, suppliesAbroad: "none" }` (`neplatce` → regular). Still fails closed if neither is set.
   - Each item needs `unitPriceWithoutVat` + `vatRate` (e.g. `21`). Storage is always exclusive.
   - If amounts are spoken/quoted **including** VAT, set `pricesIncludeVat: true` — normalizer converts to exclusive using the line rate (0 for reverse charge).
   - Never invent `legalNote` / `localReverseChargeCode`; reverse charge without a code fails.
4. `upload_invoice_files` with `invoiceId` from the create result.
5. Tell the user the draft `invoiceId`, web URL, and that Issue / Mark paid need button confirmation.
6. When they ask to issue: `issue_invoice` → wait for approval → `upload_invoice_files` again.
7. When they ask to mark paid: `mark_invoice_paid` → wait for approval.
8. When they ask to email the invoice: `send_invoice_email` → wait for approval. Pass `to` if the client has no `contactEmail`.
