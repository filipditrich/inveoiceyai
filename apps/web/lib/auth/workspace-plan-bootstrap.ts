import "server-only";
import {
  applyTriggerGrants,
  assignWorkspacePlan,
  ensureAiTokenBalance,
  listPlanClients,
  resolvePlanForNewWorkspace,
  syncPlanClientsIntoWorkspace,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { withDbTransaction } from "@invoicey/db/transaction";

/**
 * Puts a freshly created workspace onto its plan (ADR 0035, 0036, 0037).
 *
 * Exists because there are two ways a workspace comes into being: the
 * first-sign-in hook, which inserts the row itself, and Better Auth's
 * `createOrganization`, which the multi-workspace UI calls. Only the first one
 * used to resolve a plan, so a second workspace silently landed on the default
 * — the exact escape hatch the domain rule is supposed to close, and with no
 * signup grant either.
 *
 * Idempotent: the grant ledger's unique key absorbs a repeat, and assignment
 * and catalog sync are both upserts.
 */
export async function applyWorkspacePlanBootstrap(input: {
  workspaceId: string;
  owner: { email?: string | null; emailVerified?: boolean };
}): Promise<void> {
  const plan = await resolvePlanForNewWorkspace(db, input.owner);

  await ensureAiTokenBalance(db, input.workspaceId);

  // Sets plan_id and re-seeds the monthly allowance from the plan.
  await assignWorkspacePlan(db, {
    workspaceId: input.workspaceId,
    planId: plan.id,
    // Null marks this as the automatic rule, so a later manual assignment is
    // recognisably deliberate.
    assignedBy: null,
  });

  await withDbTransaction((tx) =>
    applyTriggerGrants(tx, {
      workspaceId: input.workspaceId,
      entitlements: plan.entitlements,
      trigger: "signup",
    }),
  );

  if (plan.entitlements.clients.createMode === "managed") {
    await syncPlanClientsIntoWorkspace(
      db,
      input.workspaceId,
      await listPlanClients(db, plan.id),
    );
  }
}
