/**
 * Seed a plan's managed client catalog from ARES (Plan 26c / ADR 0036).
 *
 *   bun run --cwd packages/db scripts/seed-plan-clients.ts \
 *     --plan=nfctron --ico=07283539,19099339 [--apply]
 *
 * Dry run by default. Idempotent: entries are upserted on `(plan_id, ico)`, and
 * each write re-syncs every workspace on the plan.
 *
 * Goes through the same ARES lookup and upsert the admin console uses, so a
 * seeded entry is indistinguishable from a hand-added one.
 */
import "@invoicey/env/load";

import { fetchAresEkonomickySubjekt } from "@invoicey/ares";
import { ClientSnapshotSchema } from "@invoicey/invoice-core/schema";

import { createDb } from "../src/create-db";
import { getPlanByKey } from "../src/plans-repo";
import { listPlanClients, upsertPlanClient } from "../src/plan-clients";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}
const apply = process.argv.includes("--apply");

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

const planKey = arg("plan");
const icos = (arg("ico") ?? "")
  .split(",")
  .map((v) => v.replaceAll(/\D/g, ""))
  .filter(Boolean);

if (!planKey) fail("--plan=<key> is required");
if (icos.length === 0) fail("--ico=<comma separated> is required");

const url = process.env.DATABASE_URL?.trim();
if (!url) fail("DATABASE_URL is empty");
const db = createDb(url);

const plan = await getPlanByKey(db, planKey);
if (!plan) fail(`no plan with key "${planKey}"`);

const existing = new Set(
  (await listPlanClients(db, plan.id)).map((r) => r.ico),
);

console.log(`\nplan: ${plan.name} (${plan.key})`);
if (plan.entitlements.clients.createMode !== "managed") {
  // Not fatal: an admin may be staging a catalog before flipping the mode.
  console.log(
    "  ! this plan's clients.createMode is 'open' — the catalog will not be enforced until it is 'managed'",
  );
}

const resolved: { ico: string; snapshot: Record<string, unknown> }[] = [];
for (const ico of icos) {
  const lookup = await fetchAresEkonomickySubjekt(ico);
  if (!lookup.ok) {
    fail(`ARES lookup failed for ${ico}: ${lookup.kind}`);
  }
  const snapshot = ClientSnapshotSchema.safeParse({
    id: crypto.randomUUID(),
    ...lookup.draft,
  });
  if (!snapshot.success) {
    fail(`ARES data for ${ico} does not satisfy ClientSnapshotSchema`);
  }
  resolved.push({ ico, snapshot: snapshot.data as Record<string, unknown> });
  console.log(
    `  ${existing.has(ico) ? "update" : "insert"}  ${ico}  ${snapshot.data.name}`,
  );
}

if (!apply) {
  console.log("\nDry run. Re-run with --apply to write.");
  process.exit(0);
}

let synced = 0;
for (const entry of resolved) {
  const result = await upsertPlanClient(db, {
    planId: plan.id,
    ico: entry.ico,
    snapshot: entry.snapshot,
  });
  synced = result.syncedWorkspaces;
}

console.log(
  `\n✓ ${resolved.length} catalog entries written, synced into ${synced} workspace(s)`,
);
