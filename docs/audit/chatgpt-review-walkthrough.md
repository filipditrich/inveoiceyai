# Invoicey public review walkthrough

Status: preparation only. No recorded demo or public submission yet.

## Confirmed listing

- Publisher: Ing. Filip Ditrich (individual identity still needs portal verification).
- Support: filip@ditrich.me.
- Country: CZ only.
- Commerce: no purchases or payment processing. Payment recording is bookkeeping.

## Isolated review workspace

Use a dedicated Google or GitHub identity and a separate Invoicey workspace named
Invoicey Review. Do not invite reviewers to the publisher's real workspace.
The owner must complete account creation/sign-in and any identity checks. Review
access must work without the owner's personal mailbox, phone or network. Validate
that the provider's login does not strand reviewers at an MFA challenge.

Configure a default issuer using confirmed details and seed sample drafts only.
Keep credentials outside this repository and ZIP; enter them in the portal's
secure reviewer fields. Do not weaken production authentication to make review easier.

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
   IČO 09870113, in English, payable by bank transfer. Ask for anything else you
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
