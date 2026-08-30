import "server-only";

import { clients } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, eq, isNotNull } from "drizzle-orm";

import { ForbiddenError } from "@/lib/auth/errors";
import { loadEntitlements } from "./entitlements";

/**
 * Managed-client enforcement (ADR 0036).
 *
 * Under `clients.createMode: "managed"` a workspace may only bill the
 * counterparties in its plan's catalog. The gates live here rather than in each
 * caller so that the web form, the ARES lookup, the importer, the MCP tools,
 * and the Slack agent all get the same answer — a rule enforced on only some of
 * those surfaces is decorative, because `create_invoice` over Slack reaches the
 * same database.
 */

/** True when this workspace's clients come from the plan and cannot be edited. */
export async function clientsAreManaged(workspaceId: string): Promise<boolean> {
  const { entitlements } = await loadEntitlements(workspaceId);
  return entitlements.clients.createMode === "managed";
}

/**
 * Blocks any client create / edit / delete on a managed workspace.
 *
 * Call at the top of the mutation, before validating input: the answer does not
 * depend on what was submitted, and failing early keeps the message honest.
 */
export async function assertClientsWritable(
  workspaceId: string,
): Promise<void> {
  if (await clientsAreManaged(workspaceId)) {
    throw new ForbiddenError("Clients are managed by the workspace plan");
  }
}

/**
 * Blocks issuing to a counterparty outside the catalog.
 *
 * Checked at draft *and* at issue. Checking only at issue would let someone
 * build a whole invoice against a client they were never allowed to bill and
 * discover it at the last step; checking only at draft would leave the rule
 * bypassable by any path that writes a draft directly.
 */
export async function assertClientIsBillable(
  workspaceId: string,
  clientId: string,
): Promise<void> {
  if (!(await clientsAreManaged(workspaceId))) return;

  const [row] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.id, clientId),
        eq(clients.workspaceId, workspaceId),
        isNotNull(clients.planClientId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new ForbiddenError(
      "This workspace can only invoice clients from its plan catalog",
    );
  }
}
