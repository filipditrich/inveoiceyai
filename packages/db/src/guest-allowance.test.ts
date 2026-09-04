import { describe, expect, it } from "vitest";

import { guestRetentionCutoff } from "./guest-issuance";
import { guestAllowancePeriod } from "./guest-repo";

describe("guestAllowancePeriod", () => {
  it("buckets an ordinary mid-month instant into its calendar month", () => {
    expect(guestAllowancePeriod(new Date("2026-06-15T10:00:00Z"))).toBe(
      "2026-06",
    );
  });

  it("zero-pads single-digit months", () => {
    expect(guestAllowancePeriod(new Date("2026-01-05T10:00:00Z"))).toBe(
      "2026-01",
    );
  });

  it("rolls a late-December UTC instant into next year's January in Prague", () => {
    // 23:30 UTC on Dec 31 is already 00:30 CET Jan 1 in Prague.
    expect(guestAllowancePeriod(new Date("2026-12-31T23:30:00Z"))).toBe(
      "2027-01",
    );
  });

  describe("spring-forward boundary (CET -> CEST, UTC+1 -> UTC+2)", () => {
    // Once CEST is in effect, Prague is UTC+2, so 22:00 UTC on the last day
    // of March is already midnight of April 1st locally.
    it("lands a 22:30 UTC instant on 31 March in April (Prague already past midnight)", () => {
      expect(guestAllowancePeriod(new Date("2026-03-31T22:30:00Z"))).toBe(
        "2026-04",
      );
    });

    it("keeps a 21:30 UTC instant on 31 March in March (Prague not yet at midnight)", () => {
      expect(guestAllowancePeriod(new Date("2026-03-31T21:30:00Z"))).toBe(
        "2026-03",
      );
    });
  });

  describe("fall-back boundary (CEST -> CET, UTC+2 -> UTC+1)", () => {
    // Once CET is in effect, Prague is only UTC+1, so the local
    // midnight-of-the-first instant shifts an hour later in UTC terms than
    // it was during CEST — the case that would break a fixed-offset bucketer.
    it("keeps a 22:30 UTC instant on 31 October in October (Prague not yet at midnight)", () => {
      expect(guestAllowancePeriod(new Date("2026-10-31T22:30:00Z"))).toBe(
        "2026-10",
      );
    });

    it("lands a 23:30 UTC instant on 31 October in November (Prague past midnight)", () => {
      expect(guestAllowancePeriod(new Date("2026-10-31T23:30:00Z"))).toBe(
        "2026-11",
      );
    });
  });
});

describe("guestRetentionCutoff", () => {
  it("subtracts twelve UTC calendar months", () => {
    expect(
      guestRetentionCutoff(new Date("2026-09-04T10:00:00Z")).toISOString(),
    ).toBe("2025-09-04T10:00:00.000Z");
  });

  it("crosses the year boundary", () => {
    expect(
      guestRetentionCutoff(new Date("2026-01-15T00:00:00Z")).toISOString(),
    ).toBe("2025-01-15T00:00:00.000Z");
  });
});
