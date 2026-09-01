/**
 * Seed the builtin plan rows (Plan 26a / ADR 0035).
 *
 *   bun run --cwd packages/db scripts/seed-plans.ts [--apply] [--force-entitlements]
 *
 * Dry run by default. Safe to re-run: missing plans are inserted, existing ones
 * are left alone. The database — not this file — is the source of truth once a
 * row exists, because platform admin edits entitlements in `/admin/plans` and
 * re-running the seed must not silently revert them.
 *
 * `--force-entitlements` overwrites existing rows from `plan-presets.ts`. Use it
 * to roll a new entitlement key out to untouched environments; never in
 * production without checking what an admin has changed.
 */
import "@invoicey/env/load";
import { eq } from "drizzle-orm";

import { createDb } from "../src/create-db";
import { PLAN_SEEDS } from "../src/plan-presets";
import { plans } from "../src/plans";

const flag = (name: string) => process.argv.includes(`--${name}`);
const apply = flag("apply");
const forceEntitlements = flag("force-entitlements");

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

const url = process.env.DATABASE_URL?.trim();
if (!url) fail("DATABASE_URL is empty");
const db = createDb(url);

const existing = await db.select({ key: plans.key }).from(plans);
const known = new Set(existing.map((row) => row.key));

const toInsert = PLAN_SEEDS.filter((seed) => !known.has(seed.key));
const toUpdate = forceEntitlements
  ? PLAN_SEEDS.filter((seed) => known.has(seed.key))
  : [];

console.log(`\nplans present: ${existing.length}`);
for (const seed of PLAN_SEEDS) {
  const state = known.has(seed.key)
    ? forceEntitlements
      ? "overwrite"
      : "keep"
    : "insert";
  console.log(`  ${state.padEnd(9)} ${seed.key} (${seed.kind})`);
}

if (!apply) {
  console.log("\nDry run. Re-run with --apply to write.");
  process.exit(0);
}

for (const seed of toInsert) {
  await db.insert(plans).values({
    id: crypto.randomUUID(),
    key: seed.key,
    name: seed.name,
    kind: seed.kind,
    isDefault: seed.isDefault,
    autoAssignEmailDomains: seed.autoAssignEmailDomains,
    entitlements: seed.entitlements,
  });
}

for (const seed of toUpdate) {
  await db
    .update(plans)
    .set({ entitlements: seed.entitlements, updatedAt: new Date() })
    .where(eq(plans.key, seed.key));
}

console.log(
  `\n✓ inserted ${toInsert.length}, overwrote ${toUpdate.length}, left ${
    known.size - toUpdate.length
  } untouched`,
);
