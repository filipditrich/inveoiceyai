import "server-only";
import { listPaymentNotificationRecipients } from "@/lib/payments/notify-recipients";

import {
  claimPendingPushDeliveries,
  disablePocketPushToken,
  insertNotificationDeliveries,
  listPendingNotificationEvents,
  listPushEnabledPocketDevices,
  markNotificationDeliveryFailed,
  markNotificationDeliverySent,
  markNotificationEventFailed,
  markNotificationEventProcessed,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";

import { sendApnsNotification } from "./apns";
import { buildNotificationDeliveries } from "./delivery-plan";

type ApnsSecrets = {
  keyId: string;
  teamId: string;
  privateKey: string;
  topic: string;
};

function apnsSecrets(): ApnsSecrets | null {
  const keyId = process.env.APNS_KEY_ID?.trim();
  const teamId = process.env.APNS_TEAM_ID?.trim();
  const privateKey = process.env.APNS_PRIVATE_KEY?.replaceAll(
    "\\n",
    "\n",
  ).trim();
  const topic = process.env.APNS_TOPIC?.trim();
  return keyId && teamId && privateKey && topic
    ? { keyId, teamId, privateKey, topic }
    : null;
}

async function materializeEvents(input: {
  workspaceId?: string;
  limit: number;
}): Promise<number> {
  const events = await listPendingNotificationEvents(db, input);
  let materialized = 0;
  for (const event of events) {
    try {
      const recipients = await listPaymentNotificationRecipients({
        workspaceId: event.workspaceId,
        permission: "payments:read",
      });
      const recipientUserIds = recipients.map((recipient) => recipient.userId);
      const devices = await listPushEnabledPocketDevices(db, {
        workspaceId: event.workspaceId,
        userIds: recipientUserIds,
      });
      const deliveries = buildNotificationDeliveries({
        event: {
          id: event.id,
          workspaceId: event.workspaceId,
          type: event.type,
          subjectId: event.subjectId,
          payload: event.payloadJson,
        },
        recipientUserIds,
        devices,
      });
      if (!deliveries) {
        await markNotificationEventFailed(
          db,
          event.id,
          "unsupported_event_type",
        );
        continue;
      }
      await insertNotificationDeliveries(db, deliveries);
      await markNotificationEventProcessed(db, event.id);
      materialized += 1;
    } catch (error) {
      await markNotificationEventFailed(
        db,
        event.id,
        error instanceof Error ? error.message : "materialization_failed",
      );
    }
  }
  return materialized;
}

async function sendPushDeliveries(limit: number): Promise<number> {
  const secrets = apnsSecrets();
  if (!secrets) return 0;
  const deliveries = await claimPendingPushDeliveries(limit);
  let sent = 0;
  for (const delivery of deliveries) {
    if (!delivery.token || !delivery.environment) {
      await markNotificationDeliveryFailed(db, {
        deliveryId: delivery.id,
        error: "device_push_configuration_missing",
        permanent: true,
      });
      await disablePocketPushToken(db, delivery.deviceId);
      continue;
    }
    const result = await sendApnsNotification({
      configuration: { ...secrets, environment: delivery.environment },
      deviceToken: delivery.token,
      alert: {
        notificationId: delivery.id,
        title: delivery.title,
        body: delivery.body,
        actionPath: delivery.actionPath,
        category: delivery.category,
      },
    });
    if (result.ok) {
      await markNotificationDeliverySent(db, {
        deliveryId: delivery.id,
        providerMessageId: result.providerMessageId,
      });
      sent += 1;
      continue;
    }
    await markNotificationDeliveryFailed(db, {
      deliveryId: delivery.id,
      error: result.reason,
      permanent: result.permanent,
    });
    if (result.permanent) {
      await disablePocketPushToken(db, delivery.deviceId);
    }
  }
  return sent;
}

/** Materialize durable events and opportunistically deliver pending APNs pushes. */
export async function runNotificationEngine(
  input: {
    workspaceId?: string;
    limit?: number;
  } = {},
): Promise<{ materialized: number; pushed: number }> {
  const limit = input.limit ?? 100;
  const materialized = await materializeEvents({
    workspaceId: input.workspaceId,
    limit,
  });
  const pushed = await sendPushDeliveries(limit);
  return { materialized, pushed };
}
