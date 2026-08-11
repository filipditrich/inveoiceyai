import "server-only";

import { renderWorkspaceInviteEmail } from "@invoicey/emails";
import { db } from "@invoicey/db/client";
import { env } from "@invoicey/env/server";

import { getResendClient } from "./client";
import { sendTransactionalEmail } from "./send";

export async function sendWorkspaceInviteEmail(opts: {
  workspaceId: string;
  workspaceName: string;
  to: string;
  inviterName: string;
  inviterEmail?: string | null;
  role: string;
  inviteUrl: string;
}): Promise<void> {
  if (!getResendClient()) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const rendered = await renderWorkspaceInviteEmail({
    workspaceName: opts.workspaceName,
    inviterName: opts.inviterName,
    inviteUrl: opts.inviteUrl,
    role: opts.role,
  });

  const replyTo = opts.inviterEmail?.trim() || null;

  await sendTransactionalEmail({
    db,
    workspaceId: opts.workspaceId,
    template: "workspace_invite",
    to: opts.to,
    replyTo,
    displayName: opts.inviterName,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
}

export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}
