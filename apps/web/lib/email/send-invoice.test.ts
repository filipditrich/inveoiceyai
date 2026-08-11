import { describe, expect, it } from "vitest";

import { resolveIssuerEmailSettings } from "@invoicey/invoice-tools/email";

describe("resolveIssuerEmailSettings", () => {
  it("defaults attach ISDOC and disables lifecycle mail", () => {
    const s = resolveIssuerEmailSettings({});
    expect(s.attachIsdocByDefault).toBe(true);
    expect(s.overdueRemindersEnabled).toBe(false);
    expect(s.sendPaymentReceivedEmail).toBe(false);
    expect(s.defaultSubject).toContain("{number}");
  });

  it("honors explicit false for ISDOC default", () => {
    expect(
      resolveIssuerEmailSettings({ attachIsdocByDefault: false })
        .attachIsdocByDefault,
    ).toBe(false);
  });
});
