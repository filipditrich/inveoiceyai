import { describe, expect, it } from "vitest";

import { fioAccessState } from "./fio-access";

describe("fioAccessState", () => {
  const enabledAt = new Date("2026-08-20T12:00:00.000Z");

  it("reports submit rights when the submit token is active", () => {
    expect(
      fioAccessState(
        {
          accessMode: "read_write",
          paymentEnabledAt: enabledAt,
          paymentTokenExpiresAt: new Date("2026-09-20T12:00:00.000Z"),
        },
        new Date("2026-08-24T12:00:00.000Z"),
      ),
    ).toBe("submit_enabled");
  });

  it("reports an expired submit token instead of falling back to read-only", () => {
    expect(
      fioAccessState(
        {
          accessMode: "read_write",
          paymentEnabledAt: enabledAt,
          paymentTokenExpiresAt: new Date("2026-08-21T12:00:00.000Z"),
        },
        new Date("2026-08-24T12:00:00.000Z"),
      ),
    ).toBe("submit_expired");
  });

  it("reports read-only when no submit token is stored", () => {
    expect(
      fioAccessState({
        accessMode: "read",
        paymentEnabledAt: null,
        paymentTokenExpiresAt: null,
      }),
    ).toBe("read_only");
  });
});
