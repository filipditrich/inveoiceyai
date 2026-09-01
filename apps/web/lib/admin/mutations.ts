import "server-only";
import { recordSecurityAuditEvent } from "@/lib/auth/security-audit";
import { and, eq } from "drizzle-orm";

import {
  ensureAiTokenBalance,
  grantTokensManually,
  invitation,
  member,
  user,
  workspaces,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";

export type AdminMutationResult =
  | { ok: true }
  | { ok: false; error: AdminMutationError };

export type AdminMutationError =
  | "not_found"
  | "invalid_amount"
  | "name_required"
  | "last_owner"
  | "confirmation_mismatch"
  | "failed";

/** Ceiling on a single grant — a slipped digit here is not recoverable. */
const MAX_TOKEN_GRANT = 10_000_000;

/**
 * Tops up the workspace's gifted bucket. Gifted is the right bucket for support
 * grants: it is spent before the monthly allowance, so a grant is used first
 * and does not silently inflate what the workspace pays for.
 */
export async function adminGrantTokens(input: {
  actorUserId: string;
  workspaceId: string;
  amount: number;
  note: string;
}): Promise<AdminMutationResult> {
  if (
    !Number.isInteger(input.amount) ||
    input.amount <= 0 ||
    input.amount > MAX_TOKEN_GRANT
  ) {
    return { ok: false, error: "invalid_amount" };
  }

  const [workspace] = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId))
    .limit(1);

  if (!workspace) {
    return { ok: false, error: "not_found" };
  }

  try {
    await ensureAiTokenBalance(db, workspace.id);
    // Rides the same ledger as plan and milestone awards (ADR 0037), so the
    // balance is explainable from one table rather than being an anonymous
    // increment nobody can later account for.
    await grantTokensManually({
      workspaceId: workspace.id,
      tokens: input.amount,
      grantedBy: input.actorUserId,
      note: input.note.slice(0, 500) || null,
    });
  } catch (error) {
    console.error("[admin] token grant failed", error);
    return { ok: false, error: "failed" };
  }

  await recordSecurityAuditEvent({
    userId: input.actorUserId,
    workspaceId: workspace.id,
    type: "platform_tokens_grant",
    metadata: {
      amount: input.amount,
      bucket: "gifted",
      note: input.note.slice(0, 500),
      workspaceName: workspace.name,
    },
  });

  return { ok: true };
}

export async function adminRenameWorkspace(input: {
  actorUserId: string;
  workspaceId: string;
  name: string;
}): Promise<AdminMutationResult> {
  const name = input.name.trim();
  if (!name) {
    return { ok: false, error: "name_required" };
  }

  const [workspace] = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId))
    .limit(1);

  if (!workspace) {
    return { ok: false, error: "not_found" };
  }

  await db
    .update(workspaces)
    .set({ name })
    .where(eq(workspaces.id, workspace.id));

  await recordSecurityAuditEvent({
    userId: input.actorUserId,
    workspaceId: workspace.id,
    type: "platform_workspace_rename",
    metadata: { from: workspace.name, to: name },
  });

  return { ok: true };
}

/**
 * Deletes a workspace and everything cascading from it. The caller must retype
 * the slug — this removes another tenant's invoices, and the admin console is
 * the one place where that is reachable without being a member.
 */
export async function adminDeleteWorkspace(input: {
  actorUserId: string;
  workspaceId: string;
  confirmation: string;
}): Promise<AdminMutationResult> {
  const [workspace] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
    })
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId))
    .limit(1);

  if (!workspace) {
    return { ok: false, error: "not_found" };
  }

  if (input.confirmation.trim() !== workspace.slug) {
    return { ok: false, error: "confirmation_mismatch" };
  }

  // Audit first: the row references the workspace, and the delete cascades.
  await recordSecurityAuditEvent({
    userId: input.actorUserId,
    type: "platform_workspace_delete",
    metadata: {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
    },
  });

  try {
    await db.delete(workspaces).where(eq(workspaces.id, workspace.id));
  } catch (error) {
    console.error("[admin] workspace delete failed", error);
    return { ok: false, error: "failed" };
  }

  // Members pointed at it as their default would otherwise land nowhere.
  await db
    .update(user)
    .set({ defaultWorkspaceId: null })
    .where(eq(user.defaultWorkspaceId, workspace.id));

  return { ok: true };
}

export async function adminRemoveMember(input: {
  actorUserId: string;
  workspaceId: string;
  targetUserId: string;
}): Promise<AdminMutationResult> {
  const [target] = await db
    .select({
      id: member.id,
      role: member.role,
      email: user.email,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(
      and(
        eq(member.organizationId, input.workspaceId),
        eq(member.userId, input.targetUserId),
      ),
    )
    .limit(1);

  if (!target) {
    return { ok: false, error: "not_found" };
  }

  if (target.role === "owner") {
    const owners = await db
      .select({ id: member.id })
      .from(member)
      .where(
        and(
          eq(member.organizationId, input.workspaceId),
          eq(member.role, "owner"),
        ),
      );
    if (owners.length <= 1) {
      return { ok: false, error: "last_owner" };
    }
  }

  await db.delete(member).where(eq(member.id, target.id));

  await recordSecurityAuditEvent({
    userId: input.actorUserId,
    workspaceId: input.workspaceId,
    type: "platform_member_remove",
    metadata: {
      targetUserId: input.targetUserId,
      targetEmail: target.email,
      role: target.role,
    },
  });

  return { ok: true };
}

export async function adminCancelInvite(input: {
  actorUserId: string;
  workspaceId: string;
  invitationId: string;
}): Promise<AdminMutationResult> {
  const [invite] = await db
    .select({ id: invitation.id, email: invitation.email })
    .from(invitation)
    .where(
      and(
        eq(invitation.id, input.invitationId),
        eq(invitation.organizationId, input.workspaceId),
      ),
    )
    .limit(1);

  if (!invite) {
    return { ok: false, error: "not_found" };
  }

  await db
    .update(invitation)
    .set({ status: "canceled" })
    .where(eq(invitation.id, invite.id));

  await recordSecurityAuditEvent({
    userId: input.actorUserId,
    workspaceId: input.workspaceId,
    type: "platform_invite_cancel",
    metadata: { invitationId: invite.id, email: invite.email },
  });

  return { ok: true };
}
