export type InvitationViewDetails = {
  email: string;
  status: string;
  expiresAt: Date;
};

export type InvitationViewState =
  "pending" | "expired" | "unavailable" | "email_mismatch";

export function resolveInvitationViewState(opts: {
  invitation: InvitationViewDetails;
  signedInEmail: string;
  now?: Date;
}): InvitationViewState {
  const now = opts.now ?? new Date();
  if (opts.invitation.status !== "pending") return "unavailable";
  if (opts.invitation.expiresAt.getTime() < now.getTime()) return "expired";
  if (
    opts.invitation.email.trim().toLowerCase() !==
    opts.signedInEmail.trim().toLowerCase()
  ) {
    return "email_mismatch";
  }
  return "pending";
}
