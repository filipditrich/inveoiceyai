import type { EmailMessageStatus } from "@invoicey/db";

export type ResendEventKind =
  | "sent"
  | "delivered"
  | "delivery_delayed"
  | "bounced"
  | "failed"
  | "complained"
  | "opened"
  | "clicked";

const DELIVERY_RANK: Record<EmailMessageStatus, number> = {
  queued: 0,
  sent: 1,
  delayed: 2,
  delivered: 3,
  complained: 4,
  bounced: 5,
  failed: 5,
};

export function stripResendEventType(type: string): ResendEventKind | null {
  const bare = type.startsWith("email.") ? type.slice("email.".length) : type;
  switch (bare) {
    case "sent":
    case "delivered":
    case "delivery_delayed":
    case "bounced":
    case "failed":
    case "complained":
    case "opened":
    case "clicked":
      return bare;
    default:
      return null;
  }
}

export function eventKindToStatus(
  kind: ResendEventKind,
): EmailMessageStatus | null {
  switch (kind) {
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "delivery_delayed":
      return "delayed";
    case "bounced":
      return "bounced";
    case "failed":
      return "failed";
    case "complained":
      return "complained";
    case "opened":
    case "clicked":
      return null;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** Prefer stronger delivery status; open/click leave status unchanged. */
export function mergeEmailStatus(
  current: EmailMessageStatus,
  incoming: EmailMessageStatus | null,
): EmailMessageStatus {
  if (incoming === null) return current;
  if (DELIVERY_RANK[incoming] >= DELIVERY_RANK[current]) return incoming;
  return current;
}
