# Invoicey Identity

Operator-provisioned email/password accounts for review, test and debug use.
This deliberately extends the social-only decision in ADR 0018. Customers still
register through Google/GitHub; there is no public password registration.

## Authentication

The sign-in page offers Continue with Invoicey Identity below social providers.
Credentials use Better Auth's native credential provider, password hashing,
sessions, session hooks and database rate limiting (five sign-in attempts per
minute per IP). Workspace authorization and MCP OAuth consent are unchanged.
Public email signup, password-reset and password-enrollment endpoints are disabled.
Normal authenticated password changes require the existing password. No reset
email service or bypass token is introduced.

Only the offline provisioning script creates these credentials. It refuses
existing accounts, creates an isolated workspace, gives no platform-admin role,
and leaves email unverified. A credential account row marks the identity; no
new schema column or migration is needed. Google/GitHub customers cannot add a
password through the public API. Existing social linking remains supported.

## Provision

Run from apps/web using a securely configured database environment. The command reads the inherited INVOICEY_DATABASE_URL and does not load or overwrite it from repository env files. With Vercel, use `vercel env run -e production -- bun --no-env-file scripts/provision-invoicey-identity.ts ...` from the linked app directory. Create a
private password file (0600) with a unique 16–128 character password, stored in an
operator secret manager. Never put the password in command-line arguments,
source control, a public ZIP or review notes.

```sh
bun scripts/provision-invoicey-identity.ts \
  --email=reviewer@identity.invoicey.invalid \
  --name='Invoicey Reviewer' --workspace='Invoicey Review'
# Inspect dry run, then repeat with:
# --apply --password-file=/absolute/private/password-file
```

The example reserved `.invalid` email is a login identifier, not a working
mailbox. Use a dedicated identity, never an employee's or customer's existing
email. No invitation or email verification is claimed. Store reviewer credentials
only in the submission portal's secure fields. Seed sample drafts in the new
workspace after sign-in, and complete normal issuer onboarding with confirmed
sample details. Do not connect production bank accounts or private workspaces.

## Revocation and recovery

An operator can disable access by removing the credential account row and
revoking all sessions plus MCP grants for that user. Revoking sessions is needed
because removing a password alone does not terminate existing sessions. There is
no public recovery flow; contact support. Do not use this for customer signup or
weaken authentication of existing accounts.

## Validation

Integration tests exercise real Better Auth HTTP handlers with stored password
hashes: valid login creates a session, wrong password creates none, direct signup
cannot add a user, and reset/enrollment endpoints return 404. Existing OAuth
browser regression coverage verifies workspace consent separately. Production
provisioning requires an actual configured DB; no account is created by deployment.
