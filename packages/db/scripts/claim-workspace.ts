/**
 * Makes an existing user the owner of an existing workspace.
 *
 * Written for the Plan 14 migration: the pre-auth data all lives under the
 * seeded workspace `00000000-0000-4000-8000-000000000001`, which has no owner
 * because there were no users. Sign in once first so the account exists, then
 * point it at that workspace.
 *
 *   bun run --cwd packages/db scripts/claim-workspace.ts \
 *     --email=you@example.com \
 *     --workspace-id=00000000-0000-4000-8000-000000000001 \
 *     [--name="Acme s.r.o."] [--slug=acme] [--set-default] [--apply]
 *
 * Dry run by default. Every write is conditional or ON CONFLICT DO NOTHING, so
 * re-running with --apply is a no-op.
 */
import "@invoicey/env/load";
import { eq } from "drizzle-orm";

import { member, user as userTable } from "../src/auth-schema";
import { createDb } from "../src/create-db";
import { clients, invoices, issuerBusinesses, presets } from "../src/schema";
import { workspaces } from "../src/workspaces";

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
const workspaceId = arg("workspace-id");
const newName = arg("name");
const newSlug = arg("slug");
const setDefault = flag("set-default");
const apply = flag("apply");

if (!email || !workspaceId) {
  fail("--email and --workspace-id are both required");
}

const url = process.env.DATABASE_URL?.trim();
if (!url) fail("DATABASE_URL is empty");
const db = createDb(url);

const [account] = await db
  .select({
    id: userTable.id,
    defaultWorkspaceId: userTable.defaultWorkspaceId,
  })
  .from(userTable)
  .where(eq(userTable.email, email))
  .limit(1);

if (!account) {
  fail(
    `No user with email ${email}. Sign in once at the app first, then re-run.`,
  );
}

const [workspace] = await db
  .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug })
  .from(workspaces)
  .where(eq(workspaces.id, workspaceId))
  .limit(1);

// Never create it: a typo'd id must not silently spawn an empty workspace.
if (!workspace) {
  fail(`No workspace with id ${workspaceId}. Refusing to create one.`);
}

const [existingMembership] = await db
  .select({ role: member.role })
  .from(member)
  .where(eq(member.organizationId, workspaceId))
  .limit(1);

const counts = await Promise.all(
  (
    [
      ["invoices", invoices],
      ["clients", clients],
      ["issuers", issuerBusinesses],
      ["presets", presets],
    ] as const
  ).map(async ([label, table]) => {
    const rows = await db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.workspaceId, workspaceId));
    return `${label}=${rows.length}`;
  }),
);

console.log(`\nuser       ${email} (${account.id})`);
console.log(
  `workspace  ${workspace.name} [${workspace.slug}] (${workspace.id})`,
);
console.log(`contains   ${counts.join("  ")}`);
console.log(
  `members    ${existingMembership ? `already has members (first role: ${existingMembership.role})` : "none"}`,
);

if (!apply) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply to commit.");
  process.exit(0);
}

if (newName || newSlug) {
  await db
    .update(workspaces)
    .set({
      ...(newName ? { name: newName } : {}),
      ...(newSlug ? { slug: newSlug } : {}),
    })
    .where(eq(workspaces.id, workspaceId));
  console.log("✓ updated workspace name/slug");
}

await db
  .insert(member)
  .values({
    id: crypto.randomUUID(),
    userId: account.id,
    organizationId: workspaceId,
    role: "owner",
    createdAt: new Date(),
  })
  .onConflictDoNothing();
console.log("✓ owner membership ensured");

if (setDefault || !account.defaultWorkspaceId) {
  await db
    .update(userTable)
    .set({ defaultWorkspaceId: workspaceId })
    .where(eq(userTable.id, account.id));
  console.log("✓ set as the user's default workspace");
}

console.log(
  "\nDone. Sign out and back in to pick up the new active workspace.",
);
