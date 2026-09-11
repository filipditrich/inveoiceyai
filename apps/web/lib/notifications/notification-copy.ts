import type { NotificationEventPayload } from "@invoicey/db";

export type NotificationPresentation = {
  title: string;
  body: string;
  actionPath: string;
  category: string;
};

type NotificationEvent = {
  id: string;
  type: string;
  subjectId: string;
  payload: NotificationEventPayload;
};

function text(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function czk(value: string | undefined): string | null {
  const amount = value === undefined ? Number.NaN : Number(value);
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
  }).format(amount);
}

function settledRequest(
  event: NotificationEvent,
): NotificationPresentation | null {
  const amount = czk(event.payload.amount);
  if (!amount) return null;
  const note = text(event.payload.message);
  return {
    title: "Platba přijata",
    body: note ? `Přijato ${amount} za ${note}.` : `Přijato ${amount}.`,
    actionPath: `/payments/requests/${event.subjectId}`,
    category: "payment_received",
  };
}

/** Reviewed user-facing copy for durable notification events. */
export function notificationPresentation(
  event: NotificationEvent,
): NotificationPresentation | null {
  if (event.type === "payment_request.settled") {
    return settledRequest(event);
  }
  return null;
}
