import { describe, expect, it } from "vitest";

import { notificationPresentation } from "./notification-copy";

describe("notificationPresentation", () => {
  it("turns a settled request into a Czech receive-money notification", () => {
    expect(
      notificationPresentation({
        id: "event-1",
        type: "payment_request.settled",
        subjectId: "request-1",
        payload: {
          amount: "500.00",
          currency: "CZK",
          message: "Konzultace",
        },
      }),
    ).toEqual({
      title: "Platba přijata",
      body: "Přijato 500,00 Kč za Konzultace.",
      actionPath: "/payments/requests/request-1",
      category: "payment_received",
    });
  });

  it("uses a generic body when the request has no note", () => {
    expect(
      notificationPresentation({
        id: "event-2",
        type: "payment_request.settled",
        subjectId: "request-2",
        payload: { amount: "1200", currency: "CZK", message: null },
      })?.body,
    ).toBe("Přijato 1 200,00 Kč.");
  });

  it("refuses an event type without a reviewed presentation", () => {
    expect(
      notificationPresentation({
        id: "event-3",
        type: "unknown",
        subjectId: "subject",
        payload: {},
      }),
    ).toBeNull();
  });
});
