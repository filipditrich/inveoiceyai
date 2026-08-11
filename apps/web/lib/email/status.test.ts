import { describe, expect, it } from "vitest";

import {
  eventKindToStatus,
  mergeEmailStatus,
  stripResendEventType,
} from "./status";

describe("email status mapping", () => {
  it("strips email. prefix", () => {
    expect(stripResendEventType("email.delivered")).toBe("delivered");
    expect(stripResendEventType("email.delivery_delayed")).toBe(
      "delivery_delayed",
    );
    expect(stripResendEventType("email.unknown")).toBeNull();
  });

  it("maps event kinds to delivery statuses", () => {
    expect(eventKindToStatus("delivered")).toBe("delivered");
    expect(eventKindToStatus("delivery_delayed")).toBe("delayed");
    expect(eventKindToStatus("opened")).toBeNull();
  });

  it("does not regress terminal statuses", () => {
    expect(mergeEmailStatus("bounced", "delivered")).toBe("bounced");
    expect(mergeEmailStatus("sent", "delivered")).toBe("delivered");
    expect(mergeEmailStatus("delivered", null)).toBe("delivered");
    expect(mergeEmailStatus("failed", "complained")).toBe("failed");
  });
});
