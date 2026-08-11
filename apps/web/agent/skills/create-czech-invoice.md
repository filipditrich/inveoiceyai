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
   - `meta`, `client`, `vat`, `payment`, `items`
   - `client.address` must be `{ street, city, zip, country: "CZ" }`
   - `vat` is a **top-level object** (not line `vatRate`): `{ mode, suppliesAbroad }`
     - Domestic CZ default: `{ "mode": "regular", "suppliesAbroad": "none" }`
     - `mode`: `regular` | `reverse_charge` | `oss`
     - `suppliesAbroad`: `none` | `eu` | `non_eu`
   - Each item still needs its own `vatRate` (e.g. `21`). That does not replace `vat`.
4. `upload_invoice_files` with `invoiceId` from the create result.
5. Tell the user the draft `invoiceId`, web URL, and that Issue / Mark paid need button confirmation.
6. When they ask to issue: `issue_invoice` → wait for approval → `upload_invoice_files` again.
7. When they ask to mark paid: `mark_invoice_paid` → wait for approval.
8. When they ask to email the invoice: `send_invoice_email` → wait for approval. Pass `to` if the client has no `contactEmail`.
