# Public release: retention and account closure

Status: operator approved support-handled closure via filip@ditrich.me and a 365-day maximum security-log retention on 2026-10-02. Implementation and deletion verification remain in progress; this is not yet a published policy.

## Proposed public wording

Account and workspace data remain available while the account or workspace is
active. To request an export, account closure or deletion, contact
filip@ditrich.me. We verify the requester and clarify whether the request covers
an individual account or an entire workspace. Removing an individual from a
shared workspace does not automatically delete other members' business records.

We respond to data-rights requests without undue delay and normally within one
month of receipt. This is a response deadline, not a promise that every copy is
erased within that period. If a permitted extension or retention exception
applies, we explain the reason and the applicable timing.

For an approved deletion request, we remove the relevant live records and
uploaded files without undue delay, revoke associated access, and confirm the
scope completed. Any records retained for a specific legal obligation or claim
are identified, access-restricted and retained only for the applicable purpose.
Disconnecting ChatGPT revokes its access; it does not delete Invoicey documents
or the user's ChatGPT conversation.

Security-audit retention follows the workspace plan: the currently implemented
periods are 30 or 365 days, with a 365-day ceiling including account-level logs. The unclaimed guest cleanup job removes qualifying database records after
12 months; this is not the registered-account closure process.

Deleted database records may remain in database recovery history until its
configured window expires. Invoicey's Neon project currently displays a six-hour
history window. Manual exports, snapshots and file-provider residual copies must
be handled separately; the six-hour window is not a universal erasure guarantee.

## Operator choices required

1. Approved on 2026-10-02: support-handled closure via filip@ditrich.me and responsibility for
   handling requests, exports, applicable exceptions and completion notices.
2. Approved on 2026-10-02: cap all security-log retention at 365 days. Local
   implementation passes 71 database tests and database typechecking; not deployed yet.
3. Confirm management of manually retained exports (including the local
   invoicey.dump). Do not delete the export merely to complete this checklist.

## Procedure to implement and validate before publishing

- Verify identity and authority; identify workspace co-owners and legal holds.
- Offer export before irreversible deletion; establish the exact scope.
- Inventory sessions, API keys, MCP grants, Slack links, Drive and Pocket grants.
- Revoke scoped access and prevent recreation or background writes during closure.
- Inventory database dependencies and UploadThing keys, including immutable
  imported PDFs/ISDOC, issuer assets and other uploaded attachments.
- Remove only approved data. Record failed file deletions and retry them; a
  successful database transaction alone is not completed erasure.
- Check Neon branches, snapshots and independent exports for additional copies.
- Obtain UploadThing deletion/residual-retention terms for this account; do not
  infer a numeric expiry from its general privacy statement.
- Verify closure against a disposable fixture, including attempted re-access,
  orphaned files and the case of shared workspace membership. Never use the
  review workspace or a real customer as the deletion fixture.
- Maintain a minimal completion record and notify the requester of any exception.

## Evidence and sources

- Neon console, 2026-10-02: project invoicey (super-mud-60105713), Frankfurt,
  main branch, one branch, History retention: 6 hours. Read-only inspection;
  settings unchanged. Snapshot inventory and provider residual backups unverified.
- Source: packages/db/src/audit-retention.ts, plan-presets.ts and entitlements.ts.
- Source: packages/db/src/guest-repo.ts and the guest-retention cron route.
- Existing public privacy text explicitly leaves specific retention pending.
- [EDPB guidance on individuals' rights](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en)
  distinguishes response obligations and grounds for handling rights requests.
- [Neon restore history](https://neon.com/blog/announcing-point-in-time-restore)
  explains recovery within the configured history window.
- [UploadThing privacy policy](https://uploadthing.com/info/privacy-policy)
  does not establish the account-specific file purge deadline in this audit.

## Submission consequence

The video and reviewer access are ready for preparation. Public-policy completion
remains blocked on the above decisions and deletion verification. Do not replace
published placeholders with unsupported guarantees or claim the ZIP is ready to
submit merely because the recording URL is present.

## Deletion gap found during implementation

The current adminDeleteWorkspace deletes only the workspace row and relies on
cascades. Invoice/client/issuer records include bare workspace IDs without foreign
keys, and UploadThing files are not purged by that action. Do not use this action
as evidence of completed erasure. A verified closure procedure remains required.

## Public ChatGPT website handoff

User explicitly requested on 2026-10-02: update homepage feature information and
link to the public ChatGPT extension after publication. Keep installation pending
until the approved release is actually published. Then verify the public directory
URL from a signed-out browser, replace the pending install treatment on /chatgpt,
update Czech and English availability/setup copy and integration documentation,
and verify homepage → setup → public listing on desktop and mobile widths. Do not
use the private development app URL as the public installation link.

## Upload ownership audit

The current browser upload callback receives workspace metadata but stores no
file ownership ledger. Historical unattached files cannot be attributed safely
from invoice URLs alone. UploadThing's public listFiles API lists keys but is not
an ownership database. Inspect the provider dashboard metadata before assigning
historical ownership or claiming complete closure. Dashboard inspected after operator sign-in. The sampled server-upload logs have
no workspace identifier; provider audit retention is seven days. Existing files
were not deleted.

## Persistent ownership implementation (2026-10-02)

New uploads now receive an UploadThing customId containing an encoded workspace
ID and random UUID. This is applied before browser upload, generated PDF/ISDOC
upload and extracted ISDOC upload, so abandoned forms retain attribution. No
historical files are assigned an owner by guessing names.

Validation: full Turbo tests and typecheck pass (74 database tests, 431 web tests,
96 invoice-tools tests). A disposable text file was uploaded to Invoicey's actual
UploadThing app; listFiles returned the customId intact, workspace matching passed,
and deleteFiles successfully removed only that probe. This validates the provider
round trip, not completed account closure or historical-file attribution.

Still required before public-policy completion: scoped account/workspace deletion,
file cleanup retry handling and a disposable workspace end-to-end closure test.
