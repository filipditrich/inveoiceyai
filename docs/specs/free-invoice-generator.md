# Free invoice generator

**Plans:** 34 (guest issuance), 35 (editable page) · **ADRs:**
[0048](../decisions/0048-guest-issuance-into-unclaimed-workspaces.md),
[0049](../decisions/0049-dom-look-interpreter-for-editing.md) ·
**Vocabulary:** [`CONTEXT.md`](../../CONTEXT.md)

## Goal

A public, sign-in-free surface that issues one real invoice, collects an email
address before the download, keeps the invoice, and hands it to the user when
they sign up. It demonstrates the core promise — validated invoice data in,
correct Czech invoice out — without the AI, agent, and convenience features that
Invoicey actually sells.

The generator is a funnel, and it is also the product's honest core. Nothing it
produces is a demo.

## Surfaces

| Surface                          | Purpose                                                        |
| -------------------------------- | -------------------------------------------------------------- |
| `/` teaser                       | Live, non-persisting taste; carries typed state into the route |
| `/faktura-zdarma` (`cs`)         | The generator, with its own SEO metadata and FAQ               |
| `/free-invoice-generator` (`en`) | Same surface, English metadata                                 |
| Download gate                    | Email + marketing opt-in, then immediate download              |
| Invoice mail                     | Delivers the PDF and carries the signed claim token            |
| Claim on signup                  | Address match, or claim token; bootstraps the first issuer     |

The homepage teaser sits above the existing `ProductDemo`, which keeps
demonstrating the flows the generator deliberately excludes (AI draft, agents,
payments, recurring, CLI).

## Scope

**In** — the data features are the proof:

- ARES lookup for issuer and client
- DPH modes, including non-payer and reverse charge
- CZK and EUR
- Document language `cs` / `en` ([ADR 0028](../decisions/0028-per-invoice-language.md))
- QR platba
- Embedded ISDOC ([ADR 0004](../decisions/0004-pdf-react-pdf-renderer.md) output shape)
- Classic look with colour tokens only

**Out** — convenience and scale, which is what Pro and a real account are for:

- AI draft, MCP, Slack, Eve
- Saved clients, recurring, historical import, multi-issuer
- Look catalog and the look builder
- Logo upload (unlocks on claim — [ADR 0048](../decisions/0048-guest-issuance-into-unclaimed-workspaces.md) §9)
- History: an unclaimed guest sees only the invoice they just made

## Guest issuance

1. Visitor fills the invoice. Preview is watermarked (`lockedPreview`).
2. Visitor hits download. Gate asks for an email address and an unticked
   marketing opt-in.
3. Address is checked against a bundled disposable blocklist and an MX lookup.
4. Allowance is checked: one guest issue per address per calendar month. The
   issuer IČO is recorded and may trigger a soft nudge, never a block.
5. Invoicey creates an unclaimed guest workspace on the Free plan and issues the
   invoice through the ordinary repository path — number, issuer/client/look
   snapshots, stored PDF and ISDOC artifacts.
6. The gate lifts immediately: the PDF downloads, and the same PDF plus a signed
   claim token is mailed in parallel.

Numbering is prefilled from the standard defaults and freely editable;
uniqueness is scoped to the guest workspace.

## Claiming

A guest workspace is claimed when either:

- a user signs in via OAuth with an address equal to the guest address, or
- a signed claim token from the invoice mail is followed while signed in, with
  any provider and any address.

On claim:

- the user becomes the workspace owner; the workspace stops being unclaimed
- all guest limits lift — it is now an ordinary Free workspace
- onboarding offers the invoice's issuer (ARES-resolved, with bank account) as
  the workspace's first issuer
- the dashboard shows the claimed invoices

A user who already has a workspace claims into a new one; workspaces are not
merged.

## Abuse, cost, and privacy

| Concern              | Control                                                              |
| -------------------- | -------------------------------------------------------------------- |
| Bots                 | BotID on the render and gate endpoints                               |
| Render cost          | Existing per-IP rate window and concurrency cap                      |
| Repeat freeloading   | One guest issue per address per month; IČO as a soft signal          |
| Shared IPs (CGNAT)   | IP is a coarse burst limiter only, never a hard identity             |
| Disposable addresses | Bundled blocklist + MX check; no third-party vendor sees the address |
| Hosted content       | No guest logo upload                                                 |
| Personal data        | 12-month retention on unclaimed guest data, then hard delete         |
| Marketing contact    | Separate unticked opt-in; the invoice mail itself is transactional   |

## Editable page (Plan 35)

The generator's form is replaced by the DOM look interpreter
([ADR 0049](../decisions/0049-dom-look-interpreter-for-editing.md)):

- Classic only, DOM interpreter driven by the shared style IR
- Inline editing for parties, dates, title, notes, and line-item rows
- `totals` and `tax` computed, never editable
- Side panel for VAT mode, currency, document language, and colours
- Server-side validation and issue are unchanged

## Delivery

**Plan 34 — guest issuance.** Route, teaser and state handoff, gate, disposable
check, allowance, guest workspace, issue, mail with claim token, claim on
signup, issuer bootstrap, retention job, admin filtering. Uses the existing form
and PDF preview. Every business risk in this feature lives in this slice, and it
is shippable without the interpreter.

**Plan 35 — editable page.** Style IR extraction, DOM interpreter for Classic,
inline editing, block coverage tests. Sequenced second on purpose: if the
generator does not convert, the second interpreter is never built.

## Exit criteria

### Plan 34

- [ ] A visitor with no account issues an invoice and downloads a clean PDF
- [ ] The same PDF and a claim link arrive by mail
- [ ] The invoice exists as a numbered, snapshotted, issued invoice in an
      unclaimed guest workspace
- [ ] A second attempt from the same address in the same month is refused; a
      different address on the same IP is not
- [ ] A disposable address is refused before any render
- [ ] Signing in with the guest address auto-claims; signing in with a different
      address and following the mailed token also claims
- [ ] Claiming lifts every guest limit and offers the guest issuer for onboarding
- [ ] Unclaimed workspaces are excluded from admin metrics, plan counts, and
      cross-tenant lists
- [ ] Unclaimed guest data older than 12 months is hard-deleted
- [ ] Marketing opt-in is unticked by default and recorded per address

### Plan 35

- [ ] Classic renders identically in structure through both interpreters
- [ ] A block missing from either interpreter fails to compile
- [ ] Inline edits to parties, dates, notes, and line items round-trip through
      `InvoiceSchema` and appear in the downloaded PDF
- [ ] `totals` and `tax` cannot be edited on the page
- [ ] Theme tokens flow from one style IR into both interpreters

## Out of scope

Sending the invoice to the guest's own client by email (spam vector), guest
access to any invoice but the one just issued, merging a claimed guest workspace
into an existing workspace, and the in-app builder adopting the DOM interpreter.
