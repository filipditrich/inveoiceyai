import type {
  EmailDeliveryEventKind,
  NormalizedEmailDeliveryEvent,
} from "./types";

export type ResendDeliveryWebhookPayload = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    tags?: Record<string, string> | { name: string; value: string }[];
    [key: string]: unknown;
  };
};

function tagsToRecord(
  tags:
    | Record<string, string>
    | { name: string; value: string }[]
    | undefined
    | null,
): Record<string, string> {
  if (!tags) return {};
  if (Array.isArray(tags)) {
    const out: Record<string, string> = {};
    for (const t of tags) {
      if (t?.name) out[t.name] = t.value;
    }
    return out;
  }
  return tags;
}

export function parseResendDeliveryEventType(
  type: string,
): EmailDeliveryEventKind | null {
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

/** Map a verified Resend delivery webhook to the shared event contract. */
export function parseResendDeliveryEvent(input: {
  providerEventId: string;
  payload: ResendDeliveryWebhookPayload;
}): NormalizedEmailDeliveryEvent | null {
  const kind = parseResendDeliveryEventType(input.payload.type);
  if (!kind) return null;

  const tags = tagsToRecord(input.payload.data?.tags);
  return {
    kind,
    providerEventId: input.providerEventId,
    providerMessageId: input.payload.data?.email_id,
    messageId: tags.message_id,
    occurredAt: input.payload.created_at
      ? new Date(input.payload.created_at)
      : new Date(),
    payload: input.payload as unknown as Record<string, unknown>,
  };
}
