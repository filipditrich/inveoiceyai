/**
 * Grant or revoke platform admin on an existing user (ADR 0024 / Plan 18).
 *
 *   bun run --cwd packages/db scripts/grant-platform-admin.ts \
 *     --email=you@example.com [--revoke] [--apply]
 *
 * Dry run by default. Sign in once first so the account exists.
 */
import "@invoicey/env/load";
import { eq } from "drizzle-orm";

import { user as userTable, type PlatformRole } from "../src/auth-schema";
import { createDb } from "../src/create-db";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

const email = arg("email");
const revoke = flag("revoke");
const apply = flag("apply");
const nextRole: PlatformRole = revoke ? "none" : "admin";

if (!email) {
  fail("--email is required");
}

const url = process.env.DATABASE_URL?.trim();
if (!url) fail("DATABASE_URL is empty");
const db = createDb(url);

const [account] = await db
  .select({
    id: userTable.id,
    email: userTable.email,
    platformRole: userTable.platformRole,
  })
  .from(userTable)
  .where(eq(userTable.email, email))
  .limit(1);

if (!account) {
  fail(
    `No user with email ${email}. Sign in once at the app first, then re-run.`,
  );
}

console.log(`\nuser     ${account.email} (${account.id})`);
console.log(`role     ${account.platformRole} → ${nextRole}`);

if (!apply) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply to commit.");
  process.exit(0);
}

if (account.platformRole === nextRole) {
  console.log("\nAlready at target role — no write.");
  process.exit(0);
}

await db
  .update(userTable)
  .set({ platformRole: nextRole, updatedAt: new Date() })
  .where(eq(userTable.id, account.id));

console.log(
  `\nDone. ${revoke ? "Revoked" : "Granted"} platform admin for ${account.email}.`,
);
console.log("Sign out and back in if the session still shows the old role.");
