import type {
  NewNotificationDelivery,
  NotificationEventPayload,
} from "@invoicey/db";

import { notificationPresentation } from "./notification-copy";

type Event = {
  id: string;
  workspaceId: string;
  type: string;
  subjectId: string;
  payload: NotificationEventPayload;
};

type Device = { id: string; userId: string };

export function buildNotificationDeliveries(input: {
  event: Event;
  recipientUserIds: string[];
  devices: Device[];
}): NewNotificationDelivery[] | null {
  const presentation = notificationPresentation(input.event);
  if (!presentation) return null;

  const common = {
    eventId: input.event.id,
    workspaceId: input.event.workspaceId,
    title: presentation.title,
    body: presentation.body,
    actionPath: presentation.actionPath,
    category: presentation.category,
  };
  const inbox: NewNotificationDelivery[] = input.recipientUserIds.map(
    (userId) => ({
      ...common,
      userId,
      channel: "in_app",
      destinationKey: "in_app",
    }),
  );
  const recipientIds = new Set(input.recipientUserIds);
  const push: NewNotificationDelivery[] = input.devices
    .filter((device) => recipientIds.has(device.userId))
    .map((device) => ({
      ...common,
      userId: device.userId,
      deviceId: device.id,
      channel: "push",
      destinationKey: device.id,
    }));
  return [...inbox, ...push];
}
