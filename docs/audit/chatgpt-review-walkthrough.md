# Invoicey public review walkthrough

Status: recorded demo hosted; policy completion and public submission still pending.

## Confirmed listing

- Publisher: Ing. Filip Ditrich (individual identity still needs portal verification).
- Support: filip@ditrich.me.
- Country: CZ only.
- Commerce: no purchases or payment processing. Payment recording is bookkeeping.

## Isolated review workspace

An operator-provisioned Invoicey Identity account now owns a separate workspace
named Invoicey Review, with no platform-admin access. Reviewers do not need Google
or GitHub: on `/sign-in`, choose **Continue with Invoicey Identity**, then enter the
privately supplied login identifier and password. Public password signup and reset
remain disabled. Do not invite reviewers to the publisher's real workspace.

Production sign-in was confirmed by the owner and independently repeated in the
canonical-domain browser on 2026-10-02. The reviewer lands in Invoicey Review,
with no platform-admin menu. The only seeded invoices are unissued drafts:

- REVIEW-CZ-001: Czech, CZK 4,000, five hours at 800, VAT 0.
- REVIEW-EN-002: English, EUR 4,000, five hours at 800, VAT 0.

Both use Review Client — SAMPLE and the default issuer Invoicey Review — DEMO
ONLY. The issuer is fictional (IČO 00000000), not an ARES identity. Its bank
field comes from the existing test fixture, not a verified payment destination;
sample payments use cash and `do_not_pay`. Never issue or send these fixtures.
No real customer records were copied. Credentials stay outside the repository
and ZIP. Enter them only in the portal's secure reviewer fields.

The owner approved the ChatGPT development connection on 2026-10-02. Its
selected account is labelled Invoicey Review. The workspace app and the first
chat list response both show exactly the two sample drafts above. These are development-connection results, not evidence against a saved
submission draft.

## Rehearsal and recording

The current browser tools support control and screenshots, not video recording.
Once the isolated account is connected, the owner can start macOS Screenshot
recording with Shift-Command-5 and select only the ChatGPT window. Pause recording
for sign-in and never capture passwords, tokens or unrelated conversations.

Rehearse this sequence before recording:

1. Show the Invoicey connection and selected review workspace.
2. Ask: “Show my recent invoices in Invoicey.” Verify sample records only.
3. Ask: “Open the first invoice in that list and show its details.” Compare the
   line items, currency and total with the selected result.
4. Ask: “Who is registered under IČO 09870113?” Verify the live returned identity.
5. Ask: “Help me draft a 1 CZK invoice for one item called Review example, to
   IČO 09870113, in English, payable in cash. Ask for anything else you
   need. Do not issue it.” Supply dates and VAT treatment from the sample setup.
6. Ask: “Change the draft's note to Thanks for reviewing. Keep it as a draft.”
   Verify only the note changed and the document remains unissued.
7. Ask: “Submit my VAT return to the tax authority.” Verify the capability limit
   is explained and no invoice action is substituted.

Run the remaining negative cases in the package separately. Keep CSP enforcement
enabled. Do not issue, email or mark real invoices paid for the recording.

Stop the recording, play it back, check readability and private-data exposure,
and host it at an owner-approved reviewer-accessible URL. Verify that URL without
an owner-only session before adding `review.demo_recording_url` to the package.
A script or local video is not a completed recording URL.

## Remaining policy decision

Account-closure retention, uploaded-file deletion and backup expiry need a
confirmed policy and implementation verification. Source has plan-specific audit
retention and a 12-month unclaimed guest cleanup path; these do not establish a
complete account-deletion policy. Do not publish an invented deletion deadline.

## Final portal step

After the policy and recording are complete: verify the individual publisher,
upload the rebuilt ZIP, connect its saved MCP version, run all five positive and
three negative cases, resolve required scans, and have the owner complete legal
attestations. Submit for review. Publication after approval is a separate step.

## Retention implementation audit (2026-10-02)

Verified source mechanisms: plan-based security-audit pruning and 12-month
unclaimed-guest database cleanup. Neither establishes a complete deletion flow
for registered users, uploaded artifacts, or provider backups. No end-to-end
registered-account erasure workflow was found in the inspected auth configuration.
The privacy page still explicitly says specific retention periods are pending.

Before asking the operator to approve published promises, prepare a registered
account closure procedure covering access revocation, ownership of shared
workspaces, exports, database rows, uploaded artifacts and backup expiry. Confirm
Neon/UploadThing retention from the actual project settings. Do not assume guest
cleanup also removes hosted files or that an invoice archiving obligation applies
identically to every data category.

## Development rehearsal evidence (2026-10-02)

- List: passed. ChatGPT and the workspace app listed the two seeded drafts,
  with correct currencies, totals and draft statuses.
- Detail: passed. REVIEW-EN-002 returned its client, demo issuer, dates, five
  hours at EUR 800, zero VAT and EUR 4,000 total.
- ARES lookup: passed. IČO 09870113 returned the publisher's public business
  identity; it was not substituted for the configured demo seller.
- Create: passed for persistence. ChatGPT created DRAFT-20261002-1654,
  invoice ID `21fdfd40-e4b8-489b-a97e-de9ff2d1508d`, in the review workspace.
  Read-back confirmed one Review example at CZK 1, English, cash, demo seller,
  null issuedAt and null paidAt. Dates and VAT treatment were supplied up front.
- Update: passed. ChatGPT changed the note to Thanks for reviewing. Database
  read-back and the native workspace detail agree; amount and item unchanged.
- Native controls: Refresh revealed the new draft; opening it rendered the
  actual detail and note. No issue/payment/send action was performed.
- Bank-transfer negative: safe refusal, but initial explanation focused on the
  demo restriction rather than clearly stating the platform capability limit.
  A follow-up explicitly confirmed that chat tools cannot initiate transfers
  and that recording payment is bookkeeping only.
- VAT-filing negative: passed. Explained there is no VAT-return submission
  function and did not claim submission.
- Historical-import negative: passed. Directed historical import to the web
  app, warned against importing a real archive into this demo workspace, and
  did not create replacement invoices.

These results do not establish native iOS/Android host compatibility, the
optional skill wrapper, or the final saved submission version. The floating chat
showed textual tool summaries beside the interactive workspace; a separate
inline draft card in that chat was not observed.

## Hosted recording

Demo: https://tc99v5dgse.ufs.sh/f/8wSnoaZkwaDSnWVPxpG4kZHoUE69XcWObR0r3qaFdwieAhgp

Recorded walkthrough covers list, detail, ARES lookup, creation of
DRAFT-20261002-1705, note update and all three unsupported-request cases.
Original MOV preserved on the operator Desktop. MP4 copy uploaded to Invoicey
UploadThing storage with inline disposition. Anonymous byte-range request
verified separately; no reviewer login is required to retrieve the video.

## Public submission draft — 3 October 2026

Saved in the verified individual publisher account:
https://platform.openai.com/plugins/manage/plugin_asdk_app_6ac15c60bad48191b03d0059a8f7561c

- App: asdk_app_6ac15c60bad48191b03d0059a8f7561c.
- Metadata version: appsub_6ac15c60bb008191bb2ca12d5a0367d4.
- Public package: Invoicey 1.0.3, Finance category, Ing. Filip Ditrich.
- Metadata and invoicing skill checks passed with no issues.
- Domain invoicey.app verified using the portal-issued well-known challenge.
- Package cases use per-server review metadata; plugin-level case mapping was
  rejected by this portal. MCP transport uses streamable-http.
- Public support-handled privacy and retention policy is deployed and inspected.
- OAuth consent reached the isolated Invoicey Review workspace. New access grant
  awaits operator confirmation. No submission or approval has occurred yet.
- Remaining: OAuth discovery, saved-version tests/scans, reviewer access fields,
  review targeting read-back, owner declarations and submission confirmation.
- After approval/publication: verify actual public URL and update homepage,
  /chatgpt, setup guidance and Czech/English availability copy. Do not link the
  development app as a publicly installable extension.
