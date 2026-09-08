import { describe, expect, it } from "vitest";

import {
  BANK_POLL_INTERVAL_MS,
  millisecondsUntilPollAllowed,
} from "./provider-limits";

const now = new Date("2026-09-08T10:00:00.000Z");

function ago(ms: number): Date {
  return new Date(now.getTime() - ms);
}

describe("millisecondsUntilPollAllowed", () => {
  it("allows the first poll on a connection that has never been called", () => {
    expect(
      millisecondsUntilPollAllowed({
        provider: "fio",
        lastRequestAt: null,
        now,
      }),
    ).toBe(0);
  });

  it("holds Fio to its documented 30s plus headroom", () => {
    expect(
      millisecondsUntilPollAllowed({
        provider: "fio",
        lastRequestAt: ago(1_000),
        now,
      }),
    ).toBe(30_000);
  });

  it("lets MONETA poll six times more often than Fio", () => {
    expect(BANK_POLL_INTERVAL_MS.moneta).toBeLessThan(
      BANK_POLL_INTERVAL_MS.fio,
    );
    expect(
      millisecondsUntilPollAllowed({
        provider: "moneta",
        lastRequestAt: ago(1_000),
        now,
      }),
    ).toBe(4_000);
  });

  it("reports zero rather than a negative wait once the floor has passed", () => {
    for (const provider of ["fio", "moneta"] as const) {
      expect(
        millisecondsUntilPollAllowed({
          provider,
          lastRequestAt: ago(60_000),
          now,
        }),
      ).toBe(0);
    }
  });

  it("becomes due exactly at the interval, not a tick later", () => {
    expect(
      millisecondsUntilPollAllowed({
        provider: "fio",
        lastRequestAt: ago(BANK_POLL_INTERVAL_MS.fio),
        now,
      }),
    ).toBe(0);
  });
});
