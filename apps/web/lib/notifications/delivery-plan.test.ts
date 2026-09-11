import { describe, expect, it } from "vitest";

import { buildNotificationDeliveries } from "./delivery-plan";

describe("buildNotificationDeliveries", () => {
  it("creates one inbox item per recipient and one push per active device", () => {
    const deliveries = buildNotificationDeliveries({
      event: {
        id: "event-1",
        workspaceId: "workspace-1",
        type: "payment_request.settled",
        subjectId: "request-1",
        payload: { amount: "1250", message: "Workshop" },
      },
      recipientUserIds: ["user-1", "user-2"],
      devices: [
        { id: "device-1", userId: "user-1" },
        { id: "device-2", userId: "user-1" },
      ],
    });

    expect(deliveries).not.toBeNull();
    if (!deliveries) throw new Error("expected notification deliveries");
    expect(deliveries).toHaveLength(4);
    expect(deliveries.filter((item) => item.channel === "in_app")).toHaveLength(
      2,
    );
    expect(deliveries.filter((item) => item.channel === "push")).toHaveLength(
      2,
    );
    expect(
      deliveries.find((item) => item.deviceId === "device-1"),
    ).toMatchObject({
      userId: "user-1",
      destinationKey: "device-1",
      title: "Platba přijata",
    });
  });

  it("rejects event types without reviewed copy", () => {
    expect(
      buildNotificationDeliveries({
        event: {
          id: "event-1",
          workspaceId: "workspace-1",
          type: "unknown",
          subjectId: "subject-1",
          payload: {},
        },
        recipientUserIds: ["user-1"],
        devices: [],
      }),
    ).toBeNull();
  });
});
