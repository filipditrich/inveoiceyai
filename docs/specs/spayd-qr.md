# SPAYD payload and QR specification

## Goal

Emit **Short Payment Descriptor (SPAYD) 1.0** payloads and PNG QR codes for Czech bank apps, derived from [`Invoice.payment`](../../packages/invoice-core/src/schema.ts), `issuer`, `client`, `meta`, and `totals`.

## Normative references

- Česká bankovní asociace — SPAYD (structure `SPD*1.0*[KEY:VALUE]*...`).
- Practical field list used in CZ QR platba: ACC, AM, CC, MSG, RN, X-VS, X-SS, X-KS, PT and X-SELF.

## Inputs / outputs

| Name                         | Signature                 | Behaviour                                                                                                                                                                                                                    |
| ---------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildSpaydPayload(invoice)` | `string`                  | Returns **`null`** when QR must not be shown (non-transfer or missing banking data — see rules). Else returns SPAYD string **without** leading URL scheme (some apps paste raw `SPD*`; QR library encodes that string only). |
| `renderSpaydQr(invoice)`     | `Promise<string \| null>` | If `buildSpaydPayload` is `null`, return `null`. Else generate PNG (`qrcode`), return **`data:image/png;base64,...`**.                                                                                                       |

## Mandatory vs omitted QR

Include SPAYD (and QR) **only when**:

- `payment.method === 'transfer'`, **and**
- `payment.bankAccount` is defined (schema guarantees IBAN domestic CZ MVP), **and**
- `totals.total` is **non-null** financially: round to **2 decimal places** in Kč; SPAYD `AM` is the **payable amount in koruny** (major units), e.g. `1210` or `1210.50`, **not** haléře.

For **credit notes** with negative totals: SPAYD in CZ QR usually targets **payments to supplier**. Negative amounts may confuse readers. MVP rule: **still encode** QR with negative `AM` if library accepts; otherwise **omit QR** (return `null`) for `totals.total < 0`. (Invoicey emits SPAYD for negative case as **omit**.)

## Field mapping

| SPAYD key | Source                                                                                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ACC`     | `IBAN+BIC`: format `iban + '+' + bic` **or** plain IBAN-only if no BIC; MVP: `iban` plus optional `bic` separated by `+` per ČBA guidance (if no BIC, use IBAN-only after verifying scanner compatibility — **spec for code:** `{iban}` only when `bic` absent, else `{iban}+{bic}`). |
| `AM`      | Payable total in Kč: `Math.round(total * 100) / 100`, formatted without trailing `.00` when whole-koruna (e.g. `1210`, `99.50`) — major units per ČBA SPAYD / QR platba (credit note → omit QR per above).                                                                            |
| `CC`      | `CZK`                                                                                                                                                                                                                                                                                 |
| `MSG`     | Beneficiary-facing message. Issuer template with `{number}`, `{client}`, and `{issuer}` variables; default `Faktura {number}                                                                                                                                                          | {client}`(English invoices use`Invoice`). Expanded value is truncated to 60 characters.                                               |
| `RN`      | Recipient name (`issuer.name`) truncated per limits.                                                                                                                                                                                                                                  |
| `X-VS`    | `payment.variableSymbol` if digits present.                                                                                                                                                                                                                                           |
| `X-KS`    | `payment.constantSymbol` if present.                                                                                                                                                                                                                                                  |
| `X-SS`    | `payment.specificSymbol` if present.                                                                                                                                                                                                                                                  |
| `PT`      | `IP`, requesting an instant payment when the payer's bank and transaction support it.                                                                                                                                                                                                 |
| `X-SELF`  | Optional payer-facing note. Issuer template with the same variables; default `Faktura {number}                                                                                                                                                                                        | {issuer}`(English invoices use`Invoice`). Expanded value is truncated to 60 characters. Some bank scanners may ignore this extension. |

`DT` is intentionally omitted. A future invoice due date would otherwise ask the banking app to schedule the transfer instead of initiating it now.

Order of keys inside payload: **`ACC`** first after version, then `AM`, `CC`, others in stable order documented in implementation (stable for golden snapshots).

Payload structure:

```
SPD*1.0*ACC:...*AM:...*CC:CZK*[optional keys in fixed order]*

```

Characters: uppercase keys; `*` inside values is percent-encoded as `%2A` according to the ČBA standard.

## QR generation (`qrcode` npm)

- **ECC:** `M` (default) acceptable; **`H`** preferred for scanned printed invoices / lower light.
- **Type:** PNG buffer → base64 → data URL for react-pdf.
- **Margin:** minimal safe quiet zone (library default module size); **fixed width** in px (spec: **164px**) for deterministic golden tests.
- **Error:** if encoding fails throw (should not occur for MVP inputs).

## References

- [domain/invoice-schema.md](../domain/invoice-schema.md) (`PaymentSchema`)
- [0004-pdf-react-pdf-renderer.md](../decisions/0004-pdf-react-pdf-renderer.md)
