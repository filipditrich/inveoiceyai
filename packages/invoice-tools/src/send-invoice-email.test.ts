import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveIssuerEmailSettings,
  sendInvoiceEmailById,
  deliverValidatedInvoiceEmail,
  validateIntendedEmailRecipients,
} from "./send-invoice-email";

describe("resolveIssuerEmailSettings", () => {
  it("treats overdue reminders as opt-in", () => {
    expect(resolveIssuerEmailSettings({}).overdueRemindersEnabled).toBe(false);
    expect(
      resolveIssuerEmailSettings({ overdueRemindersEnabled: true })
        .overdueRemindersEnabled,
    ).toBe(true);
  });

  it("defaults reminder interval to 7 days", () => {
    expect(resolveIssuerEmailSettings({}).overdueReminderIntervalDays).toBe(7);
    expect(
      resolveIssuerEmailSettings({ overdueReminderIntervalDays: 14 })
        .overdueReminderIntervalDays,
    ).toBe(14);
  });

  it("honors explicit false for ISDOC default", () => {
    expect(
      resolveIssuerEmailSettings({ attachIsdocByDefault: false })
        .attachIsdocByDefault,
    ).toBe(false);
  });
});

describe("server recipient suppression gate", () => {
  const message = {} as Parameters<
    typeof import("./email-transport").sendTransactionalEmail
  >[0];

  it("does not call transport for a suppressed To or Cc", async () => {
    const transport = vi.fn();
    await expect(
      deliverValidatedInvoiceEmail({
        to: "to@example.test",
        cc: [],
        isSuppressed: async () => true,
        transport: transport as never,
        message,
      }),
    ).resolves.toEqual({ ok: false, error: "suppressed" });
    await expect(
      deliverValidatedInvoiceEmail({
        to: "to@example.test",
        cc: ["cc@example.test"],
        isSuppressed: async (email) => email === "cc@example.test",
        transport: transport as never,
        message,
      }),
    ).resolves.toEqual({ ok: false, error: "suppressed" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("does not call transport for an invalid intended Cc", async () => {
    const transport = vi.fn();

    await expect(
      deliverValidatedInvoiceEmail({
        to: "to@example.test",
        cc: ["not-an-email"],
        isSuppressed: async () => false,
        transport: transport as never,
        message,
      }),
    ).resolves.toEqual({ ok: false, error: "invalid_cc" });

    expect(transport).not.toHaveBeenCalled();
  });

  it("calls transport exactly once for valid unsuppressed recipients", async () => {
    const transport = vi.fn().mockResolvedValue({
      messageId: "m",
      providerMessageId: "p",
      status: "sent",
    });
    const result = await deliverValidatedInvoiceEmail({
      to: "to@example.test",
      cc: ["cc@example.test"],
      isSuppressed: async () => false,
      transport: transport as never,
      message,
    });

    expect(result.ok).toBe(true);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "to@example.test",
        cc: ["cc@example.test"],
      }),
    );
  });
});

describe("intended email recipients", () => {
  it("rejects invalid intended Cc instead of silently dropping it", () => {
    expect(
      validateIntendedEmailRecipients("to@example.test", ["not-an-email"]),
    ).toEqual({ ok: false, error: "invalid_cc" });
  });

  it("normalizes valid intended recipients before transport", () => {
    expect(
      validateIntendedEmailRecipients("to@example.test", [" CC@example.test "]),
    ).toEqual({ ok: true, cc: ["cc@example.test"] });
  });
});

describe("sendInvoiceEmailById guards", () => {
  const previousUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (previousUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousUrl;
    }
  });

  it("fails closed when DATABASE_URL is unset", async () => {
    delete process.env.DATABASE_URL;
    const result = await sendInvoiceEmailById({
      id: "00000000-0000-4000-8000-000000000099",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/DATABASE_URL/);
    }
  });
});
