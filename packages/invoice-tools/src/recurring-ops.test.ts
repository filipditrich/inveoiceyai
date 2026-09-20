import { afterEach, describe, expect, it } from "vitest";

import { createRecurringFromInvoice } from "./recurring-ops";

describe("createRecurringFromInvoice guards", () => {
  const previousUrl = process.env.INVOICEY_DATABASE_URL;

  afterEach(() => {
    if (previousUrl === undefined) {
      delete process.env.INVOICEY_DATABASE_URL;
    } else {
      process.env.INVOICEY_DATABASE_URL = previousUrl;
    }
  });

  it("fails closed when INVOICEY_DATABASE_URL is unset", async () => {
    delete process.env.INVOICEY_DATABASE_URL;
    const result = await createRecurringFromInvoice({
      workspaceId: "ws_test",
      invoiceId: "00000000-0000-4000-8000-000000000099",
      name: "Monthly",
      cadence: "monthly",
      dayOfMonth: 1,
      todayIso: "2026-08-12",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/INVOICEY_DATABASE_URL/);
    }
  });

  it("rejects an empty name without touching the database", async () => {
    const result = await createRecurringFromInvoice({
      workspaceId: "ws_test",
      invoiceId: "00000000-0000-4000-8000-000000000099",
      name: "  ",
      cadence: "monthly",
      dayOfMonth: 1,
      todayIso: "2026-08-12",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("missing_name");
    }
  });

  it("rejects day 0", async () => {
    const result = await createRecurringFromInvoice({
      workspaceId: "ws_test",
      invoiceId: "00000000-0000-4000-8000-000000000099",
      name: "Monthly",
      cadence: "monthly",
      dayOfMonth: 0,
      todayIso: "2026-08-12",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_day");
    }
  });
});
