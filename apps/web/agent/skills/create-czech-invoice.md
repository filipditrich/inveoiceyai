---
name: create-czech-invoice
description: Step-by-step Czech invoice creation via ARES, draft render, Slack upload, and HITL issue/paid.
---

# Create a Czech invoice

1. Collect client IČO or company name and the line items with amounts. Do **not**
   chase the due date, language or DUZP — those default safely and appear tagged
   `assumed` on the review card with one-click controls. Do ask (via
   `ask_question`, with options) when the client is ambiguous, when it is unclear
   whether quoted prices include VAT, or when currency / VAT treatment is in doubt.
2. Resolve client from ARES:
   - Name only → `search_business`; if several hits, put them to the user with
     `ask_question` — one option per match, labelled `Name (IČO)` with the address
     as the option description.
   - Then `lookup_business` with the IČO (or reuse `match.address` when present).
   - Never invent street / city / ZIP / country.
3. `create_invoice` with a **complete** draft only (tool schema rejects empty/partial bags). Issuer is locked server-side — do not pass preset ids or invent UUIDs. Do not call `list_presets`. Required:
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
4. `create_invoice` posts a review card and uploads nothing. The card has a
   **Preview PDF** button; call `upload_invoice_files` only if the user asks for
   the file in words.
5. Keep the reply short — the card already shows the number, client, total and
   link. Do not repeat them, and do not narrate the buttons.
6. **Corrections go to `update_invoice_draft` with the same invoice id.** Never
   create a second draft to fix the first. Only pass the fields that change;
   `items` replaces the whole list.
7. Issuing is normally the user's click on the card. If they ask you in words:
   `issue_invoice` with `confirm { clientName, total }` copied from the card →
   wait for Allow/Deny.
8. Same for `mark_invoice_paid` (`confirm { number, total }`) and
   `send_invoice_email` (`confirm { number, clientName }`; pass `to` if the client
   has no `contactEmail`). Copy the values from the card — never invent them.
