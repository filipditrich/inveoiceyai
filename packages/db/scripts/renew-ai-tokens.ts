/**
 * Renew AI monthly token periods (no rollover).
 *
 *   bun run --cwd packages/db scripts/renew-ai-tokens.ts [--workspace=<id>] [--apply]
 *
 * Dry run by default. Without --workspace, renews all due workspaces.
 */
import "@invoicey/env/load";
import { eq } from "drizzle-orm";

import {
  aiTokenBalances,
  renewDueAiTokenPeriods,
  renewMonthlyPeriod,
} from "../src/ai-tokens";
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

const workspaceId = arg("workspace");
const apply = flag("apply");
const now = new Date();

const url = process.env.DATABASE_URL?.trim();
if (!url) fail("DATABASE_URL is empty");
const db = createDb(url);

if (workspaceId) {
  const [row] = await db
    .select()
    .from(aiTokenBalances)
    .where(eq(aiTokenBalances.workspaceId, workspaceId))
    .limit(1);
  if (!row) {
    fail(`No ai_token_balances row for workspace ${workspaceId}`);
  }
  console.log(`\nworkspace  ${workspaceId}`);
  console.log(`period end ${row.periodEnd.toISOString()}`);
  console.log(
    `monthly    ${row.monthlyRemaining} / ${row.monthlyLimit} (gifted ${row.giftedRemaining}, purchased ${row.purchasedRemaining})`,
  );
  if (!apply) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply to renew.");
    process.exit(0);
  }
  const summary = await renewMonthlyPeriod(db, workspaceId, now);
  console.log(`\nRenewed. Next period ends ${summary.periodEnd.toISOString()}`);
  console.log(`monthly remaining ${summary.monthlyRemaining}`);
  process.exit(0);
}

const due = await db
  .select({
    workspaceId: aiTokenBalances.workspaceId,
    periodEnd: aiTokenBalances.periodEnd,
  })
  .from(aiTokenBalances);

const dueNow = due.filter((r) => r.periodEnd.getTime() <= now.getTime());
console.log(`\nbalances ${due.length}; due ${dueNow.length}`);
for (const row of dueNow.slice(0, 20)) {
  console.log(
    `  ${row.workspaceId}  period_end=${row.periodEnd.toISOString()}`,
  );
}
if (dueNow.length > 20) {
  console.log(`  …and ${dueNow.length - 20} more`);
}

if (!apply) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply to renew.");
  process.exit(0);
}

const result = await renewDueAiTokenPeriods(db, now);
console.log(`\nRenewed ${result.renewed} workspace(s).`);
