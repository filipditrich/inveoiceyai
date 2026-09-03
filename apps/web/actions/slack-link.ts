"use server";

import { recordSecurityAuditEvent } from "@/lib/auth/security-audit";
import { requireWorkspace, requireWritableWorkspace } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

import {
  consumeSlackLinkCode,
  deleteSlackIdentityForUser,
  findSlackIdentity,
  getSlackLinkCode,
  getWorkspaceName,
  rebindSlackIdentityWorkspace,
  slackLinkConfirmDecision,
  upsertSlackIdentity,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";

export type ConfirmSlackLinkError = "not_found" | "expired" | "steal_refused";

export type ConfirmSlackLinkResult =
  | { ok: true; decision: "insert" | "rebind" }
  | { ok: false; error: ConfirmSlackLinkError };

export async function confirmSlackLinkAction(
  code: string,
): Promise<ConfirmSlackLinkResult> {
  const { userId, workspaceId } = await requireWritableWorkspace();
  const row = await getSlackLinkCode(db, code);
  if (!row) return { ok: false, error: "not_found" };

  const existing = await findSlackIdentity(db, {
    slackTeamId: row.slackTeamId,
    slackUserId: row.slackUserId,
  });
  const decision = slackLinkConfirmDecision({
    existingUserId: existing?.userId ?? null,
    confirmingUserId: userId,
  });

  switch (decision) {
    case "steal_refused":
      return { ok: false, error: "steal_refused" };
    case "insert":
    case "rebind":
      break;
    default: {
      const _exhaustive: never = decision;
      return _exhaustive;
    }
  }

  const consumed = await consumeSlackLinkCode(db, code);
  if (!consumed) return { ok: false, error: "expired" };

  await upsertSlackIdentity(db, {
    slackTeamId: consumed.slackTeamId,
    slackUserId: consumed.slackUserId,
    userId,
    workspaceId,
  });

  await recordSecurityAuditEvent({
    userId,
    workspaceId,
    type: decision === "rebind" ? "slack_rebind" : "slack_link",
    metadata: {
      slackTeamId: consumed.slackTeamId,
      slackUserId: consumed.slackUserId,
      previousWorkspaceId: existing?.workspaceId ?? null,
    },
  });

  revalidatePath("/settings/workspace/integrations");
  revalidatePath("/settings/account/security");
  return { ok: true, decision };
}

export async function unlinkSlackIdentityAction(input: {
  slackTeamId: string;
  slackUserId: string;
}): Promise<{ ok: boolean }> {
  const { userId, workspaceId } = await requireWorkspace();
  const ok = await deleteSlackIdentityForUser(db, {
    userId,
    slackTeamId: input.slackTeamId,
    slackUserId: input.slackUserId,
  });
  if (ok) {
    await recordSecurityAuditEvent({
      userId,
      workspaceId,
      type: "slack_unlink",
      metadata: {
        slackTeamId: input.slackTeamId,
        slackUserId: input.slackUserId,
      },
    });
  }
  revalidatePath("/settings/workspace/integrations");
  revalidatePath("/settings/account/security");
  return { ok };
}

export async function rebindSlackIdentityAction(input: {
  slackTeamId: string;
  slackUserId: string;
}): Promise<{ ok: boolean }> {
  const { userId, workspaceId } = await requireWritableWorkspace();
  const ok = await rebindSlackIdentityWorkspace(db, {
    userId,
    slackTeamId: input.slackTeamId,
    slackUserId: input.slackUserId,
    workspaceId,
  });
  if (ok) {
    const workspaceName = await getWorkspaceName(db, workspaceId);
    await recordSecurityAuditEvent({
      userId,
      workspaceId,
      type: "slack_rebind",
      metadata: {
        slackTeamId: input.slackTeamId,
        slackUserId: input.slackUserId,
        workspaceName,
      },
    });
  }
  revalidatePath("/settings/workspace/integrations");
  revalidatePath("/settings/account/security");
  return { ok };
}
