const INBOX_STATUSES = [
  "received",
  "processing",
  "processed",
  "no_invoice",
  "rejected",
  "failed",
] as const;

export type InboxStatusMessageKey =
  `itemStatus.${(typeof INBOX_STATUSES)[number]}`;

export function inboxStatusMessageKey(status: string): InboxStatusMessageKey {
  return (
    INBOX_STATUSES.includes(status as (typeof INBOX_STATUSES)[number])
      ? `itemStatus.${status}`
      : "itemStatus.received"
  ) as InboxStatusMessageKey;
}
