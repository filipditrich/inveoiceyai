const INCOMING_STATUSES = [
  "needs_validation",
  "unsupported",
  "validated",
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
      : "status.needs_validation"
  ) as IncomingStatusMessageKey;
}
