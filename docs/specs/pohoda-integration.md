# Pohoda integration

**Parent:** [payables lifecycle](./payables-lifecycle.md) ·
**ADR:** [0037](../decisions/0037-pohoda-xml-as-the-reference-rail.md) ·
**Companion:** [accounting layer](./accounting-layer.md)

G3 and the accounting half of G5: pushing an approved incoming invoice into
POHODA with its full accounting layer, and closing it out when the bank debit
lands.

## Scope, decided 2026-08-25

**Only the `xml_file` rail is in scope.** Invoicey generates a Pohoda dataPack;
the accountant imports it by hand. There is no live connection to anyone's
POHODA — no mServer, no REST API, no codelist sync, no likvidace in either
direction.

The accounting system is one optional layer of the product, not its centre. A
workspace that never enables it loses nothing but the export screen.

The rest of this document stays as written because the analysis is expensive and
correct, and the deferred rails are the obvious next steps. Sections marked
**deferred** are not built in plan 25.

Everything in §1 was verified against the published schemas and the live
OpenAPI document, not inferred. The findings there decide the architecture, so
they come first.

---

## 1. What each rail can actually do

### 1.1 mPohoda REST API

`https://api.mpohoda.cz` · OpenAPI 3.0 · available only in the **mPohoda Pro**
tier · auth is OAuth 2.0 client credentials against
`https://ucet.pohoda.cz/connect/token` (scope `Mph.OpenApi.Access.Cz`) **plus** an
`Api-Key` header.

Relevant endpoints:

| Endpoint                                     | Use                       |
| -------------------------------------------- | ------------------------- |
| `POST /v1/ReceivedInvoices`                  | Create a received invoice |
| `GET /v1/ReceivedInvoices?ModifiedSince=…`   | Poll for changes          |
| `GET /v1/ReceivedInvoices/{id}`              | Read one                  |
| `GET /v1/BusinessPartners`, `POST …`         | Address book              |
| `GET /v1/Centres`, `GET /v1/Activities`      | Codelists — read-only     |
| `GET /v1/VatRates`, `GET /v1/PaymentMethods` | Codelists — read-only     |

`CreateReceivedInvoiceDto` accepts `SupplierInfo` (with `DocumentNumber` — the
supplier's invoice number — plus `BankAccountNumber`, `BankCode`,
`MessageForRecipient`), `IssueDate`, `TaxDate`, `DueDate`, `VariableSymbol`,
`CurrencyId`, `ExchangeRate`, `CentreId`, `ActivityId`, `ContractNumber`,
`Text`, `Note`, `InternalNote`, `IsSynchronizationToPhEnabled`, and `Items`.
Line items (`CreateReceivedInvoiceTextItemDto`) carry their own `CentreId` and
`ActivityId`.

**Three limitations, all decisive:**

1. **No předkontace.** The DTO has no field for it. mPohoda assigns pre-accounting
   from its own settings on import. A workspace that wants Invoicey to control
   předkontace cannot use this rail.
2. **No členění DPH.** Same. VAT is expressed only as a `VatRateTypeEnum`
   (`ZeroVatRate` / `BasicVatRate` / `FirstReducedVatRate` / `SecondReducedVatRate`).
3. **No liquidation of received invoices.** `Liquidate/Standalone/Fully` and
   `…/Partially` exist for `IssuedInvoices` and `IssuedAdvanceInvoices` **only**.
   There is no received-invoice equivalent, and `ReceivedInvoiceDto` exposes no
   payment or rest-to-pay field, so settlement can be neither written nor read
   back. G5 is impossible on this rail.

### 1.2 Pohoda XML via mServer

`POST http://host:port/xml`, `Content-Type: text/xml`, Basic credentials in an
`STW-Authorization` header, optional `STW-Application` and `STW-Instance`.
`GET /status?companyDetail` reports the accounting unit. Requests are processed
**synchronously and serially** — one mServer instance is bound to **one
accounting unit** and queues concurrent callers.

`invoiceHeaderType` carries everything the accounting layer needs:
`accounting` (předkontace), `classificationVAT` (členění DPH), `centre`,
`activity`, `contract`, `symVar`, `symConst`, `symSpec`, `dateTax`,
`dateAccounting`, `dateDue`, `partnerIdentity`, `paymentAccount`, `extId`.
`invoiceItemType` carries per-line `accounting`, `classificationVAT`, `centre`,
`activity` and `contract` — an exact match for the header-default / line-override
model.

Liquidation: `inv:liquidation` and `inv:liquidations` are annotated **"pouze pro
export, při importu je ignorováno"**. Settlement is written through the **Bank
agenda** instead — `bnk:bank` with `bnk:bankLiquidationItem` /
`bnk:liquidationItem`, whose `sourceDocument` points at the liquidated invoice
("Definice položek pro likvidaci dokladu (Pohledávky/Závazku). Pouze pro
import.").

Codelists export through the `List_*` schemas: `List_centre`, `List_activity`,
`List_contract`, `List_addBook`. **There is no published list export for
předkontace or členění DPH**, so those two arrive by CSV import or manual entry
per [accounting layer](./accounting-layer.md) §2.

### 1.3 The decision

| Capability                    | mPohoda REST | Pohoda XML |
| ----------------------------- | ------------ | ---------- |
| Create received invoice       | ✅           | ✅         |
| Předkontace                   | ❌           | ✅         |
| Členění DPH                   | ❌           | ✅         |
| Středisko / činnost / zakázka | ✅           | ✅         |
| Per-line dimensions           | partial      | ✅         |
| Likvidace                     | ❌           | ✅ (Bank)  |
| Codelist sync                 | partial      | partial    |
| No customer infrastructure    | ✅           | ❌         |

**Pohoda XML is the reference rail** (ADR 0037). It is the only one that can
express the process this epic specifies.

Because mServer requires a reachable desktop POHODA — which most customers will
not expose — the same XML builder serves a second transport:

| Rail              | Transport                                                                                         | Infrastructure needed |
| ----------------- | ------------------------------------------------------------------------------------------------- | --------------------- |
| **`xml_file`**    | We produce a dataPack file; the accountant imports it via Soubor → Datová komunikace → XML import | none                  |
| **`xml_mserver`** | We POST the same dataPack to mServer                                                              | reachable mServer     |
| **`mpohoda_api`** | REST, with §1.1's limitations shown in settings                                                   | mPohoda Pro           |

One builder, three transports. **`xml_file` is the rail plan 25 builds.** It
works for every customer on day one, including NFCtron, needs no infrastructure
on either side, and — with response-pack parsing — still gives real per-document
error reporting. The other two are deferred.

---

## 2. Connection model

```
accounting_connections
  id, workspace_id, issuer_id,
  provider: 'pohoda',
  rail: 'xml_file' | 'xml_mserver' | 'mpohoda_api',
  is_active,
  company_ico,                       -- must match the issuer, checked at connect
  -- xml_mserver
  base_url, username_encrypted, password_encrypted,
  -- mpohoda_api
  client_id, client_secret_encrypted, api_key_encrypted,
  -- behaviour
  require_export_before_payment boolean default true,
  liquidation_mode: 'off' | 'statement_import' default 'off',
  document_number_series text,
  default_payment_method text,
  last_probe_at, last_probe_result,
  created_by_user_id, created_at, updated_at
```

One connection **per issuer** — a workspace with two legal entities books into
two accounting units, and mServer binds one unit per instance anyway.

Secrets use the existing `BANK_TOKEN_ENCRYPTION_KEY_V1` envelope pattern from
[payment ledger](./payment-ledger-fio.md) §"Secret handling": encrypted at rest,
never returned to the client, never logged.

**Connect flow.** Choose rail → enter credentials → **Ověřit spojení**, which
for `xml_mserver` calls `GET /status?companyDetail` and asserts the returned IČO
equals the issuer's, and for `mpohoda_api` fetches a token and reads
`GET /v1/Centres`. A mismatched IČO fails the connection outright — exporting
into the wrong accounting unit is unrecoverable.

For `xml_file` there is nothing to verify, so the step instead shows a sample
dataPack and the import path in POHODA.

---

## 3. Export

### 3.1 Job queue

```
accounting_export_jobs
  id, workspace_id, connection_id, incoming_invoice_id,
  kind: 'invoice' | 'liquidation',
  attempt, status: 'queued' | 'running' | 'succeeded' | 'failed' | 'superseded',
  request_xml_sha256, response_excerpt,
  error_code, error_message,
  external_document_id, external_number,
  created_at, started_at, finished_at
```

Enqueued when `status` becomes `approved` and a connection is active. Runs on the
existing cron path beside the bank sync. Approval never waits on it.

Retries are bounded and backed off; a job that fails `max_attempts` times leaves
`accounting_state = failed` with the provider's message verbatim and a
**Zkusit znovu** action. A retry after an edit supersedes the previous job.

### 3.2 Identity and idempotency

Every exported invoice carries `extId`:

```xml
<inv:extId>
  <typ:ids>invoicey</typ:ids>
  <typ:exSystemItemId>{incoming_invoice.id}</typ:exSystemItemId>
</inv:extId>
```

POHODA treats a repeated `extId` as the same document, so a retry updates rather
than duplicates. `STW-Check-Duplicity` is set on mServer requests as a second
guard.

A third guard, taken from the NFCtron integration, is worth keeping because it
has caught real races: when an import fails with a note matching
`/již existuje|duplicitní/i`, treat it as **success**, not as an error. That
integration relies on it entirely — it does not use `extId` — so it is proven
against POHODA SQL. Here it is a backstop behind `extId`, not the mechanism. For `mpohoda_api`, which has no `extId`, idempotency is ours to keep: the
job holds a unique index on `(connection_id, incoming_invoice_id, kind)` where
`status <> 'superseded'`, and a create is attempted only once per job.

### 3.3 Mapping

| Invoicey                                           | Pohoda XML                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| —                                                  | `inv:invoiceType` = `receivedInvoice`                                        |
| `id`                                               | `inv:extId`                                                                  |
| `number`                                           | `inv:symVar` when numeric, else `inv:text` prefix                            |
| `variable_symbol`                                  | `inv:symVar` (wins over `number`)                                            |
| `constant_symbol`, `specific_symbol`               | `inv:symConst`, `inv:symSpec`                                                |
| `issue_date`                                       | `inv:date`                                                                   |
| `tax_date`                                         | `inv:dateTax`                                                                |
| `accounting_date`                                  | `inv:dateAccounting`                                                         |
| `due_date`                                         | `inv:dateDue`                                                                |
| `supplier` → IČO, DIČ, name, address               | `inv:partnerIdentity` → `typ:address`                                        |
| `issuer`                                           | `inv:myIdentity`                                                             |
| `predkontace_id` → code                            | `inv:accounting` → `typ:ids`                                                 |
| `vat_classification_id` → code                     | `inv:classificationVAT`                                                      |
| `centre_id` / `activity_id` / `contract_id` → code | `inv:centre` / `inv:activity` / `inv:contract`                               |
| `currency`, FX                                     | `inv:foreignCurrency` when not CZK                                           |
| `beneficiary_*`                                    | `inv:paymentAccount`                                                         |
| `message_for_recipient`                            | `inv:messageForRecipient` (≤ 35 chars)                                       |
| line `description`                                 | `inv:invoiceItem` → `typ:text` (≤ 90 chars)                                  |
| line resolved dimensions                           | per-line `accounting` / `centre` / `activity` / `contract`                   |
| line VAT rate                                      | `typ:rateVAT` — enum `none` \| `low` \| `third` \| `high`, **not** a percent |

Two rules that cause silent corruption if missed, and so are asserted in the
builder:

- **UTF-8.** The dataPack declares `encoding="UTF-8"` and the request sends
  `Content-Type: text/xml; charset=UTF-8`. This is not the folklore answer —
  Windows-1250 is what older integration guides recommend — but it is what
  NFCtron's production integration has been sending to a POHODA SQL mServer for
  years (§9). Do not "fix" it to Windows-1250 without a failing test.
- Field lengths are **truncated at the schema's maximum**, never passed through.
  Truncation is recorded on the job so it is visible, not silent:

  | Field                      | Max |
  | -------------------------- | --- |
  | `typ:string90` — item text | 90  |
  | `inv:text` — header text   | 240 |
  | `typ:ids`                  | 19  |
  | company                    | 96  |
  | street                     | 64  |
  | city                       | 45  |
  | zip                        | 15  |
  | `messageForRecipient`      | 35  |

Money is emitted from minor units through `@invoicey/payment-core`, never from a
float.

### 3.4 The `xml_file` experience

An export job on this rail produces a downloadable dataPack instead of an HTTP
call, and `accounting_state` moves to `exported` **only when the accountant
confirms the import**, not when the file is generated. The screen is:

1. **Připravit dávku** — every approved, not-yet-exported invoice for the issuer,
   selectable, defaulting to all.
2. **Stáhnout XML** — one dataPack containing all of them.
3. **Potvrdit import** — with a paste box for POHODA's response XML. If it is
   pasted, we parse `<rsp:responsePack>` per document and mark each invoice
   `exported` or `failed` with its real message; if it is skipped, all are
   marked `exported` on the accountant's word, and the trail says so.

Parsing the response pack is worth the effort: it turns a manual rail into one
with real per-document error reporting.

---

## 4. Codelist sync

> **Deferred.** In plan 25, codelist values are entered by hand or imported from CSV — see [accounting layer](./accounting-layer.md) §2. This section describes the sync that replaces that later.

| Codelist    | `xml_mserver`          | `mpohoda_api`                 | `xml_file`   |
| ----------- | ---------------------- | ----------------------------- | ------------ |
| Střediska   | `List_centre` export   | `GET /v1/Centres`             | CSV / manual |
| Činnosti    | `List_activity` export | `GET /v1/Activities`          | CSV / manual |
| Zakázky     | `List_contract` export | `ContractNumber` is free text | CSV / manual |
| Předkontace | CSV / manual           | n/a                           | CSV / manual |
| Členění DPH | CSV / manual           | n/a                           | CSV / manual |

Sync runs nightly and on demand. Items are upserted on `external_id`, and items
absent from a sync are archived rather than deleted
([accounting layer](./accounting-layer.md) §2).

The CSV import accepts `code,name,note`, deduplicates on `code`, and previews
before committing.

---

## 5. Likvidace

### 5.1 Why the default is off

If the customer imports their bank statement into POHODA themselves — the common
case — and Invoicey also pushes bank documents, the bank agenda is double-booked
and the customer's accounts are wrong. Nothing in POHODA prevents this, and we
cannot detect it reliably from outside.

So `liquidation_mode` defaults to `off`, and switching to `statement_import`
requires an owner to confirm a dialog that states in plain Czech: **"Od této
chvíle přestaňte importovat bankovní výpisy do POHODY ručně. Invoicey je bude
importovat za vás."**

### 5.2 `statement_import`

> **Deferred.** Needs a live mServer connection.

When a debit is matched and its allocation confirmed
([payables spec](./payables-payment-runs-fio.md) §Allocation), we emit a Bank
agenda document:

```xml
<bnk:bank version="2.0">
  <bnk:bankHeader>
    <bnk:bankType>expense</bnk:bankType>
    <bnk:account><typ:ids>{pohoda bank account code}</typ:ids></bnk:account>
    <bnk:statementNumber><bnk:statementNumber>{n}</bnk:statementNumber></bnk:statementNumber>
    <bnk:datePayment>{value date}</bnk:datePayment>
    <bnk:symVar>{variable symbol}</bnk:symVar>
    <bnk:partnerIdentity>…</bnk:partnerIdentity>
  </bnk:bankHeader>
  <bnk:bankLiquidationItem>
    <bnk:settingsLiquidation>
      <bnk:sourceAgenda>receivedInvoice</bnk:sourceAgenda>
      <bnk:sourceDocument>
        <typ:extId>
          <typ:ids>invoicey</typ:ids>
          <typ:exSystemItemId>{incoming_invoice.id}</typ:exSystemItemId>
        </typ:extId>
      </bnk:sourceDocument>
      <bnk:liquidationPrice>{amount}</bnk:liquidationPrice>
    </bnk:settingsLiquidation>
  </bnk:bankLiquidationItem>
</bnk:bank>
```

Referencing the invoice by our `extId` rather than by number or VS is what makes
this reliable — it is the same key we exported under.

One bank document per bank transaction, carrying one liquidation item per
allocation, so a debit that pays four invoices produces one document with four
items. On success `accounting_state` becomes `settled`.

**Reversing an allocation** in Invoicey does **not** automatically reverse the
POHODA document. It raises a `liquidation_reversal_required` finding on the
invoice naming the POHODA document number, because a bank document that has been
posted is the accountant's to unwind, not ours.

### 5.3 Reading settlement back

> **Deferred.** Needs a live mServer connection.

**Feasible on the XML rails, and worth doing.** `inv:liquidation` is ignored on
import but _populated on export_, and `lst:listInvoiceRequest` with
`invoiceType="receivedInvoice"` exports it. NFCtron's integration already uses
`listInvoiceRequest` in production to read issued invoices back by number and by
series range, so the mechanism is proven — only the invoice type differs.

That means a workspace on `liquidation_mode = 'off'` — the default, where the
customer settles invoices themselves in POHODA — can still have Invoicey **learn**
that an invoice was settled, by polling. `accounting_state` reaches `settled`
without us ever writing to the Bank agenda.

That turns the safe default into the _good_ default rather than the merely
cautious one, so it belongs in **25i** rather than being deferred:

| Mode               | We write to POHODA   | We learn settlement |
| ------------------ | -------------------- | ------------------- |
| `off`              | no                   | yes, by polling     |
| `statement_import` | yes, the Bank agenda | from our own push   |

Not available on `mpohoda_api`, where `ReceivedInvoiceDto` exposes no payment
state at all.

---

## 6. Failure and observability

| Failure                         | Surface                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| mServer unreachable             | Job retries; after `max_attempts`, `accounting_state = failed` and settings shows the connection as unhealthy |
| POHODA rejects the document     | Verbatim `<rsp:responsePack>` message on the invoice, with the field it names highlighted                     |
| Codelist code missing in POHODA | Pre-flight validation at G1 refuses a dimension whose `external_id` is archived                               |
| IČO mismatch at connect         | Connection refused                                                                                            |
| Encoding or truncation applied  | Recorded on the job, shown as an `info` note on the invoice                                                   |
| Duplicate `extId`               | POHODA updates; we treat it as success and record it as an update                                             |

Every export and every liquidation writes a `payment_audit_events` row with
`entity_type = 'accounting_export'` and the dotted actions
`accounting.exported`, `accounting.export_failed`, `accounting.liquidated`,
`accounting.unlocked`.

---

## 7. Reference implementation

NFCtron already runs a POHODA SQL mServer integration in production, for **issued**
invoices. It is not a competitor to this spec — it is a proven baseline for the
transport and the awkward details, and 25f should read it before writing a line.

`nfctron-api`, `packages/helpers/src/pohoda/`:

| File                    | What to take from it                                                               |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `mserver-client.ts`     | Headers, auth, `POST /xml`, `GET /documents/…`, `prn:print` PDF retrieval          |
| `mserver-xml.ts`        | dataPack envelope, namespace map, `lst:listInvoiceRequest` with `ftr:filter`       |
| `mserver-response.ts`   | `parseResponsePack` — `ok` when every pack and item state is `ok` **or** `warning` |
| `issued-invoice-xml.ts` | Schema-max truncation constants, `rateVAT` mapping, date and money formatting      |

Concretely settled by it:

- Built with **`xmlbuilder2`**; the dataPack carries
  `version="2.0"`, `id`, `ico`, `application`, `note`.
- Headers: `STW-Authorization: Basic base64(user:pass)`, `STW-Application`, and
  `STW-Instance` when set.
- Config shape to mirror: `POHODA_MSERVER_URL`, `_USERNAME`, `_PASSWORD`,
  `_INSTANCE`.
- Status projection to mirror: `pohoda_status` ∈ `PENDING` | `UPLOADED` |
  `ERROR`, plus `pohoda_error` and `pohoda_uploaded_at` — the same shape as
  `accounting_state` here.
- Stormware's own reference pages, better than the XSDs for mapping:
  `api.stormware.cz/pohoda/xml-import-podporovana-data/faktury/faktury/` and
  `api.stormware.cz/pohoda/xml-tisk/`.

### 7.1 The network constraint this reveals

> **Deferred** with the `xml_mserver` rail. Recorded because it is the first
> thing that will block that rail when it is picked up.

mServer sits behind **IP allowlisting**. NFCtron solved it with a reserved
regional address and Cloud NAT, pinning a private GKE node pool so that only the
workloads calling mServer egress through a stable IP
(`scripts/gke-pohoda-egress/`).

Invoicey runs on Vercel, where functions have **no stable egress IP**. So
`xml_mserver` is not reachable from a normal deployment, and this is a
deployment problem, not a code problem. Options, in the order they should be
considered:

| Option                                                                                   | Cost                                        |
| ---------------------------------------------------------------------------------------- | ------------------------------------------- |
| Ship `xml_file` only for the pilot                                                       | none — the accountant imports the dataPack  |
| A small always-on relay with a static IP that forwards authenticated requests to mServer | one tiny service to run and secure          |
| Vercel Secure Compute                                                                    | enterprise tier                             |
| Reuse NFCtron's existing egress path                                                     | couples our product to their infrastructure |

**Proposed:** `xml_file` for the pilot, relay behind it. The relay is a good
long-term answer anyway, because every customer's mServer will be allowlisted
and a single known egress IP is something we can document once.

---

## 8. Testing

| Area             | Coverage                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| XML builder      | Golden dataPack files: domestic CZK, EUR with FX, credit note, per-line dimensions, reverse charge |
| Encoding         | Windows-1250 round-trip of `ěščřžýáíé`; a name that must truncate                                  |
| Response parsing | `<rsp:responsePack>` with `state="ok"`, `state="error"`, and a mixed pack                          |
| Idempotency      | Same `extId` twice produces one document; retry after edit supersedes                              |
| Liquidation XML  | One debit → four allocations → one bank document with four items                                   |
| mPohoda adapter  | Token refresh, 429 backoff, `ModifiedSince` paging                                                 |
| Connect probe    | IČO match and mismatch                                                                             |
| Mapping          | Every row of §3.3 asserted against a golden file                                                   |

No test carries a real customer's IČO, credentials, or supplier document.

---

## 9. Open questions

Reduced to two by the reference implementation in §9. Both are answered by the
**25f probe**, run against NFCtron's live mServer before the slice is built.

1. **Attachments.** Whether the invoice PDF can be pushed onto the POHODA
   document through XML, or must be placed in the documents folder and linked by
   path. NFCtron's integration only pulls PDFs _out_ (`prn:print` plus
   `GET /documents/…`), so the inbound direction is untested.
2. **Předkontace and členění DPH codelist export.** No published `List_*` schema
   exists for either. Whether a generic `listAccountingRequest` /
   `listClassificationVATRequest` returns them is one probe; the fallback is CSV
   import, which is acceptable because both lists are short and stable.

**Answered:**

- _Number series._ POHODA assigns `inv:number`; we key on `extId`. Confirmed
  workable — the NFCtron integration reads numbers back with
  `listInvoiceRequest` rather than assigning them.
- _POHODA variant._ NFCtron runs **POHODA SQL** with mServer exposed. That is
  the pilot target, so E1 behaviour is out of scope until a customer needs it.
- _Reading settlement back._ Feasible after all — see §5.3.
