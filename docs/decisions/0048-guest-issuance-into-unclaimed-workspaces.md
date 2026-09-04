# 0048: Guest issuance writes real invoices into unclaimed workspaces

## Status

Accepted (2026-09-03)

## Context

Invoicey has no top-of-funnel. The marketing page demonstrates the product with
a canned `ProductDemo`, and everything real is behind an OAuth wall
([ADR 0018](./0018-better-auth-oauth-only.md)). A Czech freelancer searching
"faktura zdarma" has no way to find out whether our PDFs are any good without
creating an account first.

We want a public **free invoice generator**: no sign-in, a stripped-down form, a
real PDF at the end, and an email address collected before the download. The
addresses become a lead list; the invoices become the reason to sign up later
("we already have your invoices").

That forces a question we cannot dodge: what _is_ the document a stranger
downloads? `CONTEXT.md` says an issued invoice is an immutable historical
record with frozen issuer, client, and look snapshots. The visitor will send
this PDF to their customer and their accountant will book it. If we call it a
draft, a demo, or a sample, we would be handing someone a tax document that our
own database does not consider to have been issued — and when they later claim
it, "we kept your invoices" would mean "we kept your scratch pads".

The storage question follows from it. A guest has no user and therefore no
workspace, but every issued-invoice mechanism we own — numbering, snapshotting,
artifact persistence, regeneration, the invoices repository, the status engine —
is workspace-scoped.

There is also a plan-model trap. `plan-presets.ts` defines Free as _a complete
solo Czech invoicing tool_: unlimited invoices, unlimited history, recurring,
import, agent surfaces. Pro sells seats, bank reconciliation, permissions, and
the look catalog ([ADR 0035](./0035-plans-are-shared-entitlement-rows.md)). It
is tempting to fund the funnel by paywalling invoice history on Free and
pointing converted guests at Pro. That would retrofit a limit onto the plan we
market as complete, and it would land on the users who _just_ had the "you kept
my invoices!" moment — spending trust exactly where we had earned it.

Finally, identity. We are OAuth-only. A guest types `jan@firma.cz` at the
download gate and three weeks later signs in with Google as `jan@gmail.com`.
Matching on address alone loses those users silently, and a silent failure in
the one delightful moment of the funnel is worse than no funnel.

## Decision

1. **A guest issue is a real issue.** The free invoice generator produces an
   ordinary issued invoice: numbered, snapshotted (issuer, client, look), stored
   artifacts, immutable. There is no demo, sample, or quarantined invoice state.

2. **Guest invoices live in a guest workspace.** At the download gate Invoicey
   creates a real `workspaces` row on the Free plan with no owner, marked
   unclaimed, and issues through the normal repository path. No parallel
   `guest_invoices` table and no second issue/render/store code path, because a
   migration at claim time is precisely where a historical record gets corrupted.
   Every admin metric, plan count, and cross-tenant listing filters unclaimed
   workspaces out.

3. **Numbering belongs to the guest.** The invoice number is prefilled from the
   standard numbering defaults and is freely editable; uniqueness is enforced
   only within the guest workspace. An Invoicey-assigned global sequence would
   collide with the series the visitor already keeps in their own books.

4. **The limit is on the guest tier, never on Free.** One guest issue per email
   address per month. The issuer IČO is counted as a signal and may drive a soft
   nudge, but never a hard block: IČO is public ARES data, so a hard block would
   let anyone burn a real company's allowance. Claiming lifts every guest limit —
   a claimed workspace is an ordinary Free workspace, with all of its invoices
   readable, regenerable, and editable under normal Free rules.

5. **Claiming works by address match or by signed token.** At download we email
   the PDF; that mail carries a signed claim token. Claiming happens either
   automatically when an OAuth address equals the guest address, or by following
   the token from the mail while signed in with any provider or address. The
   mail therefore delivers the artifact, evidences the address, and repairs the
   address-mismatch case in one step.

6. **The gate does not block on verification.** Submitting the address lifts the
   gate immediately: the PDF downloads and is mailed in parallel. Bot and cost
   abuse is handled by BotID, rate limiting, and render-concurrency caps that
   already guard `/api/demo/invoice-pdf` — not by making a human wait for a
   round-trip through their inbox.

7. **Claiming bootstraps onboarding.** A guest invoice already contains an
   ARES-resolved issuer with address and bank account. At claim we offer that
   issuer as the workspace's first issuer, so a converting user arrives at a
   dashboard that already has their business and their first invoice in it.

8. **Guest data is retained for 12 months, then hard-deleted.** Unclaimed guest
   workspaces, their invoices, artifacts, and addresses. Marketing contact
   requires a separate, unticked opt-in at the gate; the invoice mail itself is
   transactional. Disposable addresses are rejected by a bundled blocklist plus
   an MX check, so no lead's address is sent to a third-party verification
   vendor.

9. **Guests cannot upload a logo.** Colour tokens only; the logo unlocks on
   claim. Accepting arbitrary images from anonymous strangers into our upload
   account, served from `invoicey.app`, is a content-moderation liability we
   decline to own for a funnel feature.

## Consequences

### Positive

- The document a visitor downloads and the record we keep are the same thing.
- Issue, numbering, snapshot, artifacts, and regeneration have exactly one
  implementation for guests and members alike.
- Claiming is an ownership change, not a data migration.
- Pro keeps selling capability (seats, bank, permissions, looks) rather than
  access to a user's own history.

### Negative

- `workspaces` gains a population of rows that are not tenants in any meaningful
  sense. Every cross-tenant query must filter them, and forgetting to is a
  metrics bug that will look like growth.
- Unverified strangers can write invoices — including their clients' personal
  data — into our database. Retention, deletion, and the abuse budget are
  ongoing obligations, not launch tasks.
- A guest who neither claims nor opens the mail is unrecoverable by design.

### Neutral

- The Invoicey footer link already renders on every invoice
  (`InvoicePdfDocument.tsx`), so the growth loop needs no renderer change.
- Watermarking applies to the on-screen preview only, reusing the existing
  `lockedPreview` treatment; the delivered PDF is clean.

## Alternatives considered

**Guest output is a draft or a watermarked sample.** Rejected — it makes the
free generator a toy, and the pitch is that our invoices genuinely work.

**A dedicated `guest_invoices` table.** Rejected — isolation is attractive right
up to the claim migration, which has to reproduce numbering and snapshot
semantics exactly or silently damage a historical record.

**Paywall invoice history on Free; sell Pro on access to it.** Rejected — it
contradicts the Free plan we ship and market, and it monetises by holding a
user's own tax documents hostage at the moment they have just converted.

**Hard-block the monthly allowance on IP or IČO.** Rejected — CGNAT means one
blocked IP is an entire office or mobile carrier, and a public IČO is a griefing
vector. The allowance exists to control render cost and nudge signup, not to
defeat a determined freeloader who was never going to pay.

**Verify the email before releasing the download.** Rejected — the delay costs
conversions at the exact moment of highest intent, and an address that bounces
was not a lead.

## References

- [ADR 0018](./0018-better-auth-oauth-only.md) — OAuth-only auth
- [ADR 0019](./0019-workspaces-are-better-auth-organizations.md) — workspaces as organizations
- [ADR 0035](./0035-plans-are-shared-entitlement-rows.md) — plans and entitlements
- [ADR 0039](./0039-looks-are-data-react-pdf-interprets.md) — looks are data
- [ADR 0049](./0049-dom-look-interpreter-for-editing.md) — the editable page
- [`docs/specs/free-invoice-generator.md`](../specs/free-invoice-generator.md)
- Vocabulary: [`CONTEXT.md`](../../CONTEXT.md)
