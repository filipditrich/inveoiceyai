# Research: Czech OSVČ companion

**Status:** Potential direction; not promised or scheduled
**Researched:** 2026-08-13

## Product thesis

Invoicey could grow from invoice automation into a Czech OSVČ operating
companion for people who do not already understand the administrative system.
The product would guide a person through starting, running, understanding, and
closing a small self-employed business while retaining human approval for legal
submissions and payments.

This is broader than a tax calculator and narrower than a full accounting
system. Issued invoices and payments are the core business ledger; explicit
user facts and official return data supply what invoices cannot establish.

```mermaid
flowchart LR
    Start["Start podnikání"] --> Run["Invoice and get paid"]
    Run --> Understand["Understand the business"]
    Understand --> Close["Close and file the year"]
    Close --> Next["Pay balances and schedule advances"]
    Next --> Run
```

## Research evidence

A redacted review of a real 2025 OSVČ filing showed that one annual close was
not one form or one calculation:

- the income-tax return applied percentage expenses and produced a balance plus
  new income-tax advances;
- the resulting tax base fed separate ČSSZ and health-insurance workflows;
- a transition out of student status split the year month-by-month between
  secondary and main activity for ČSSZ and changed which months were subject to
  the health-insurance minimum;
- the school-related reason required documentary evidence;
- each authority used different deadlines, accounts, variable symbols,
  advances, result documents, and portal state;
- later portal balances could show small arrears even after a form had been
  successfully processed, including cases where a payment was allocated to an
  older obligation.

The product therefore needs an obligation lifecycle and evidence trail. A
single annual `main | secondary` field or a one-time tax estimate is not enough.

## Proposed product areas

### Start — personalized administration

Ask understandable questions rather than presenting a generic article:

- intended work and required trade authorization;
- actual start date versus the date a trade authorization is obtained;
- study, employment, parental leave, pension, disability, and other concurrent
  statuses;
- health insurer, data box, and available electronic identity;
- expected income, actual versus percentage expenses, and lump-sum regime;
- Czech, EU, and non-EU customers and VAT/identified-person exposure.

From those facts, generate a dated checklist for trade registration, IČO,
ČSSZ, health insurance, tax choices, payment setup, evidence, and recurring
obligations. Every instruction should say why it applies, cite its official
source, and record the rule version used.

### Run — invoices and payments

Keep invoice creation, issue, sending, correction, reminders, recurring drafts,
PDF, ISDOC, AI, MCP, and Slack as first-class surfaces. Replace binary
`invoices.paid_at` as the sole payment fact with a payment ledger capable of
partial, combined, excess, reversed, and foreign-currency payments. See
[payment-ledger and bank-integration research](./payment-ledger-bank-integration.md).

### Understand — deterministic insights

Useful views over invoices and allocated payments include:

- invoiced versus collected revenue;
- receivables, overdue aging, and expected recurring revenue;
- average payment time and clients becoming slower;
- revenue concentration by client;
- issuer, currency, country, and VAT-treatment breakdowns;
- year-over-year and month-over-month comparisons;
- an explainable tax/insurance reserve estimate with explicit coverage gaps.

All totals should come from deterministic queries and versioned calculation
rules. AI may explain or explore the results but should not be the authoritative
calculator.

### Close — guided year-end workflow

Model the close as dependent steps:

1. Reconcile invoices, credit notes, payments, and open receivables.
2. Resolve missing income and personal/business facts.
3. Calculate and review the §7 inputs.
4. Prepare and hand off the DPFO submission.
5. Import or confirm the final submitted tax base.
6. Prepare the ČSSZ overview and required evidence.
7. Prepare the applicable health-insurer overview.
8. Record submission receipts and resulting balances.
9. Generate payments and new recurring advances.
10. Verify that all authority portals show the expected state.

Invoices alone cannot establish employment income, other income categories,
deductions, children, spouse, assets, depreciation, prior losses, insurance
circumstances, or non-invoice business income. Invoicey must collect these
facts explicitly or clearly exclude them from an estimate.

## Life-event timeline

Store effective-dated events rather than one current profile value.

| Event                              | Potential effects                                                 |
| ---------------------------------- | ----------------------------------------------------------------- |
| Study started or ended             | ČSSZ activity classification, health state-payer status, evidence |
| Employment started or ended        | Secondary-activity tests, health minimum and advances             |
| Business started, paused, or ended | Notifications, active months, advances, annual filing scope       |
| Parental leave or pension          | Insurance treatment and evidence                                  |
| VAT registration or cancellation   | Invoice rules and filing obligations                              |
| Health insurer changed             | Split reporting and payment destination                           |

Derived tasks must retain the source event, applicable period, rule version,
official source, explanation, due date, completion evidence, and supersession
history.

## Portal integration strategy

Do not begin with a browser robot storing government-portal credentials.
Authentication, portal UI changes, legal responsibility, and silent filing
errors make that a poor first boundary.

Prefer **prepare → hand off → verify**:

1. Invoicey calculates and explains the candidate filing.
2. It creates the official machine-readable format where one is published.
3. The user authenticates in the official portal, imports, reviews, and submits.
4. The resulting XML, PDF, or receipt returns to Invoicey.
5. Invoicey verifies important fields, records evidence, and creates follow-up
   obligations and payments.

MOJE daně publishes DPFDP7 structures/XSDs for third-party applications and an
XML loader. ČSSZ publishes its OSVČ XML data sentence. Health-insurer adapters
will differ: VZP publishes an XDP template for accounting systems and offers an
authenticated guided form, but the path should not be generalized to every
insurer without provider-specific validation.

## Human-readable year-end workbook

CSV/XML/JSON remain useful interchange formats. The main artifact for a small
business owner or accountant should be a polished XLSX workbook with localized
formats, filters, frozen headers, visible formulas, explanatory notes,
print-ready summaries, and color-coded exceptions.

Candidate tabs:

1. `Start here`
2. `Annual overview`
3. `Issued invoices`
4. `Payments received`
5. `Open receivables`
6. `Tax calculation`
7. `ČSSZ calculation`
8. `Health insurance`
9. `VAT and foreign supplies`
10. `Checks and warnings`
11. `Submission checklist`
12. `Source documents`

The workbook is the review artifact, not the authoritative filing format.

## Potential sequencing

This direction is not scheduled. If selected later, the dependency order is:

1. payment ledger and transaction allocation;
2. OSVČ profile, life-event timeline, evidence, and obligation engine;
3. invoice/payment insights;
4. year-end close workspace and XLSX workbook;
5. official-format generators and guided portal handoff;
6. provider-specific submission and portal-state integrations where safe and
   supported.

## Boundaries

- No claim that issued invoices alone produce a complete tax return.
- No inferred activity type, expense percentage, or personal tax fact without
  confirmation.
- No invented legal deadlines or rules; every rule is dated and sourced.
- No unattended filing or payment in the initial scope.
- No storage of government-portal credentials for browser automation.
- No presentation as legal, tax, or accounting advice without appropriate
  review and product/legal positioning.

## Sources consulted

- [Financial Administration — starting a business](https://financnisprava.gov.cz/cs/dane/zivotni-situace/zacinate-podnikat)
- [Financial Administration — OSVČ, tax evidence, and percentage expenses](https://financnisprava.gov.cz/cs/dane/dane/dan-z-prijmu/fyzicke-osoby/podnikatel-osvc)
- [MOJE daně — structures for third-party applications](https://adisspr.mfcr.cz/pmd/dokumentace/popis-struktur-epo)
- [MOJE daně — loading an XML filing](https://adisspr.mfcr.cz/dpr/adis/idpr_epo/epo2/uvod/nacteni_souboru.faces)
- [ČSSZ — OSVČ overview](https://www.cssz.gov.cz/osvc-v-kostce)
- [ČSSZ — 2025 OSVČ data sentence](https://www.cssz.cz/documents/20143/3201321/DV_OSVC25.pdf/cd3fe989-b5e3-1dcf-bfab-895d22f937ff?version=1.1)
- [ČSSZ — students and social security](https://www.cssz.cz/documents/20143/99584/2026_01_studenti_a_socialni_zabezpeceni.pdf/b90d6826-c5a0-b4f0-aee7-1049a0e5e971)
- [VZP — OSVČ overview form and XDP](https://www.vzp.cz/platci/formulare/prehled-o-vysi-danoveho-zakladu-osvc)
- [VZP — concurrent activities](https://www.vzp.cz/platci/informace/osvc/platba-pojistneho-pri-soubehu-cinnosti)
- [VZP — 2026 advance-payment exceptions](https://www.vzp.cz/o-nas/tiskove-centrum/otazky-tydne/ktere-osvc-nemusi-hradit-zalohy-v-roce-2026)
