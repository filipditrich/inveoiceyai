import {
  resolveLinkedSlackPrincipal,
  tryCreateDbFromEnv,
  type LinkedSlackPrincipal,
  type SlackIdentityRecord,
} from "@invoicey/db";

import {
  attrString,
  isSlackSession,
  type MeteringAuth,
} from "./metering-identity";

export type SlackAuthOverlay = {
  authenticator?: string;
  principalId?: string;
  principalType?: string;
  attributes?: Record<string, unknown> | null;
};

export function slackIdsFromAuth(
  auth: MeteringAuth | null | undefined,
): { slackTeamId: string; slackUserId: string } | null {
  const teamId = attrString(auth?.attributes, "team_id");
  const userId = attrString(auth?.attributes, "user_id");
  if (!teamId || !userId) return null;
  return { slackTeamId: teamId, slackUserId: userId };
}

export function slackDisplayNameFromAuth(
  auth: MeteringAuth | null | undefined,
): string | null {
  return (
    attrString(auth?.attributes, "full_name") ??
    attrString(auth?.attributes, "user_name") ??
    null
  );
}

/** Overlay Invoicey ids onto Slack Connect auth without replacing the principal. */
export function overlayInvoiceyIdentity<T extends SlackAuthOverlay>(
  auth: T,
  identity: Pick<SlackIdentityRecord, "userId" | "workspaceId">,
): T {
  return {
    ...auth,
    attributes: {
      ...(auth.attributes ?? {}),
      workspaceId: identity.workspaceId,
      userId: identity.userId,
    },
  };
}

export function linkedSlackWorkspace(
  auth: MeteringAuth | null | undefined,
): { workspaceId: string; userId: string } | null {
  if (!isSlackSession(auth)) return null;
  const workspaceId = attrString(auth?.attributes, "workspaceId");
  const userId = attrString(auth?.attributes, "userId");
  if (!workspaceId || !userId) return null;
  return { workspaceId, userId };
}

export function slackToolAuthError(
  auth: MeteringAuth | null | undefined,
): "not_linked" | null {
  if (!isSlackSession(auth)) return null;
  return linkedSlackWorkspace(auth) ? null : "not_linked";
}

export type SlackSessionAuthPair = {
  current?: MeteringAuth | null;
  initiator?: MeteringAuth | null;
};

export type SlackPrincipalLookup = (ids: {
  slackTeamId: string;
  slackUserId: string;
}) => Promise<LinkedSlackPrincipal>;

function identityFromOverlay(
  auth: MeteringAuth | null | undefined,
  linked: { userId: string; workspaceId: string },
): SlackIdentityRecord {
  const ids = slackIdsFromAuth(auth);
  return {
    userId: linked.userId,
    workspaceId: linked.workspaceId,
    slackTeamId: ids?.slackTeamId ?? "",
    slackUserId: ids?.slackUserId ?? "",
  };
}

/**
 * HITL / button resumes re-derive Slack auth without Invoicey overlay
 * attributes. Prefer overlay on current, then look up `slack_identities`.
 */
export async function resolveSlackToolPrincipal(
  sessionAuth: SlackSessionAuthPair,
  lookup?: SlackPrincipalLookup,
): Promise<LinkedSlackPrincipal | { status: "not_slack" }> {
  const current = sessionAuth.current;
  const initiator = sessionAuth.initiator;
  if (!isSlackSession(current) && !isSlackSession(initiator)) {
    return { status: "not_slack" };
  }

  const currentLinked = linkedSlackWorkspace(current);
  if (currentLinked) {
    return {
      status: "linked",
      identity: identityFromOverlay(current, currentLinked),
    };
  }

  const ids = slackIdsFromAuth(current) ?? slackIdsFromAuth(initiator);
  if (ids) {
    if (lookup) return lookup(ids);
    const database = tryCreateDbFromEnv();
    if (!database) return { status: "unlinked" };
    return resolveLinkedSlackPrincipal(database, ids);
  }

  const initiatorLinked = linkedSlackWorkspace(initiator);
  if (initiatorLinked) {
    return {
      status: "linked",
      identity: identityFromOverlay(initiator, initiatorLinked),
    };
  }

  return { status: "unlinked" };
}
