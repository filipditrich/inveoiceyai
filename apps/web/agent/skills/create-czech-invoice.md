---
name: create-czech-invoice
description: Step-by-step Czech invoice creation via ARES, draft render, Slack upload, and HITL issue/paid.
---

# Create a Czech invoice

1. Collect client IČO (or name + address), line items with amounts, due date, and currency (CZK default).
2. `lookup_business` with the IČO; merge returned draft into the client.
3. `create_invoice` with a partial draft (`meta`, `client`, `items`, `payment` as needed). Issuer is locked server-side.
4. `upload_invoice_files` with `invoiceId` from the create result.
5. Tell the user the draft `invoiceId`, web URL, and that Issue / Mark paid need button confirmation.
6. When they ask to issue: `issue_invoice` → wait for approval → `upload_invoice_files` again.
7. When they ask to mark paid: `mark_invoice_paid` → wait for approval.
