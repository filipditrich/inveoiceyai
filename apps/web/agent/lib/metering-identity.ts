export type MeteringAuth = {
  authenticator?: string;
  principalId?: string;
  principalType?: string;
  attributes?: Record<string, unknown> | null;
};

export type MeteringIdentity = {
  workspaceId: string;
  /** Invoicey `users.id` only — never a Slack/Eve principal. */
  userId: string | undefined;
  slackTeamId: string | undefined;
  slackUserId: string | undefined;
  principalId: string | undefined;
};

export function attrString(
  attrs: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  const value = attrs?.[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Slack Connect sessions use `slack-webhook` and `slack:<team>:<user>` principals. */
export function isSlackSession(auth: MeteringAuth | null | undefined): boolean {
  if (!auth) return false;
  if (auth.authenticator === "slack-webhook") return true;
  return (auth.principalId ?? "").startsWith("slack:");
}

/**
 * Resolve workspace + Invoicey user for AI metering.
 *
 * Slack `defaultSlackAuth` sets `principalType: "user"` and
 * `principalId: "slack:<team>:<user>"`. That id is not in `users`, so passing
 * it as `ai_usage_events.user_id` violates the FK and rolls back the debit.
 */
export function meteringIdentityFromAuth(
  auth: MeteringAuth | null | undefined,
  fallbackWorkspaceId: string,
): MeteringIdentity {
  const attrs = auth?.attributes ?? undefined;
  const fromAuthWorkspace = attrString(attrs, "workspaceId");
  return {
    workspaceId:
      isSlackSession(auth) && !fromAuthWorkspace
        ? ""
        : (fromAuthWorkspace ?? fallbackWorkspaceId),
    userId: attrString(attrs, "userId"),
    slackTeamId: attrString(attrs, "team_id"),
    slackUserId: attrString(attrs, "user_id"),
    principalId: auth?.principalId,
  };
}
