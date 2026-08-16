const INCOMING_STATUSES = [
  "needs_review",
  "extract_failed",
  "accepted",
  "pending_approval",
  "approved",
  "on_hold",
  "rejected",
  "cancelled",
] as const;

export type IncomingStatusMessageKey =
  `status.${(typeof INCOMING_STATUSES)[number]}`;

export function incomingStatusMessageKey(
  status: string,
): IncomingStatusMessageKey {
  return (
    INCOMING_STATUSES.includes(status as (typeof INCOMING_STATUSES)[number])
      ? `status.${status}`
      : "status.needs_review"
  ) as IncomingStatusMessageKey;
}
