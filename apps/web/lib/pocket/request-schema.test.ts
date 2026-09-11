import { describe, expect, it } from "vitest";

import { PocketRequestSchema } from "./request-schema";

describe("PocketRequestSchema", () => {
  it("accepts a positive standalone payment request", () => {
    expect(
      PocketRequestSchema.safeParse({
        op: "payment_requests.create",
        amount: "500.00",
        message: "Konzultace",
      }).success,
    ).toBe(true);
  });

  it("rejects zero and more than two decimal places", () => {
    expect(
      PocketRequestSchema.safeParse({
        op: "payment_requests.create",
        amount: "0",
      }).success,
    ).toBe(false);
    expect(
      PocketRequestSchema.safeParse({
        op: "payment_requests.create",
        amount: "1.001",
      }).success,
    ).toBe(false);
  });

  it("validates APNs device tokens before registration", () => {
    expect(
      PocketRequestSchema.safeParse({
        op: "device.register_push",
        token: "ab".repeat(32),
        environment: "sandbox",
      }).success,
    ).toBe(true);
    expect(
      PocketRequestSchema.safeParse({
        op: "device.register_push",
        token: "not-a-token",
        environment: "sandbox",
      }).success,
    ).toBe(false);
  });

  it("accepts invoice discovery and watch operations", () => {
    expect(
      PocketRequestSchema.safeParse({ op: "invoices.list_unpaid", limit: 20 })
        .success,
    ).toBe(true);
    expect(
      PocketRequestSchema.safeParse({
        op: "invoices.watch",
        invoiceId: "00000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(true);
  });
});
