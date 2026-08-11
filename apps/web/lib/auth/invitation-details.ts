import "server-only";

import { invitation, user, workspaces } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { eq } from "drizzle-orm";

import {
  resolveInvitationViewState,
  type InvitationViewState,
} from "./invitation-view-state";

export type { InvitationViewState };
export { resolveInvitationViewState };

export type InvitationDetails = {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: Date;
  organizationId: string;
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
};

export async function loadInvitationDetails(
  invitationId: string,
): Promise<InvitationDetails | null> {
  const [row] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      organizationId: invitation.organizationId,
      organizationName: workspaces.name,
      inviterName: user.name,
      inviterEmail: user.email,
    })
    .from(invitation)
    .innerJoin(workspaces, eq(workspaces.id, invitation.organizationId))
    .innerJoin(user, eq(user.id, invitation.inviterId))
    .where(eq(invitation.id, invitationId))
    .limit(1);

  return row ?? null;
}
