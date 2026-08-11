import { afterEach, describe, expect, it } from "vitest";

import {
  resolveIssuerEmailSettings,
  sendInvoiceEmailById,
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
