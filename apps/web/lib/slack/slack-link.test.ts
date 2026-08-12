import { describe, expect, it } from "vitest";

import {
  generateSlackLinkCode,
  isSlackLinkCodeOpen,
  slackLinkConfirmDecision,
} from "@invoicey/db";

import { resolveSlackLinkViewState } from "./link-view-state";

describe("slackLinkConfirmDecision", () => {
  it("inserts when no identity exists", () => {
    expect(
      slackLinkConfirmDecision({
        existingUserId: null,
        confirmingUserId: "user-a",
      }),
    ).toBe("insert");
  });

  it("rebinds when the same Invoicey user confirms again", () => {
    expect(
      slackLinkConfirmDecision({
        existingUserId: "user-a",
        confirmingUserId: "user-a",
      }),
    ).toBe("rebind");
  });

  it("refuses steal when a different Invoicey user confirms", () => {
    expect(
      slackLinkConfirmDecision({
        existingUserId: "user-a",
        confirmingUserId: "user-b",
      }),
    ).toBe("steal_refused");
  });
});

describe("isSlackLinkCodeOpen", () => {
  const now = new Date("2026-08-12T12:00:00.000Z");

  it("rejects consumed codes", () => {
    expect(
      isSlackLinkCodeOpen(
        {
          expiresAt: new Date("2026-08-12T12:10:00.000Z"),
          consumedAt: new Date("2026-08-12T11:59:00.000Z"),
        },
        now,
      ),
    ).toBe(false);
  });

  it("rejects expired codes", () => {
    expect(
      isSlackLinkCodeOpen(
        { expiresAt: new Date("2026-08-12T11:59:00.000Z"), consumedAt: null },
        now,
      ),
    ).toBe(false);
  });

  it("accepts unconsumed unexpired codes", () => {
    expect(
      isSlackLinkCodeOpen(
        { expiresAt: new Date("2026-08-12T12:15:00.000Z"), consumedAt: null },
        now,
      ),
    ).toBe(true);
  });
});

describe("resolveSlackLinkViewState", () => {
  const now = new Date("2026-08-12T12:00:00.000Z");

  it("maps missing, consumed, expired, and pending rows", () => {
    expect(resolveSlackLinkViewState(null, now)).toBe("not_found");
    expect(
      resolveSlackLinkViewState(
        {
          code: "abc",
          slackTeamId: "T1",
          slackUserId: "U1",
          slackUserName: null,
          expiresAt: new Date("2026-08-12T12:15:00.000Z"),
          consumedAt: now,
        },
        now,
      ),
    ).toBe("consumed");
    expect(
      resolveSlackLinkViewState(
        {
          code: "abc",
          slackTeamId: "T1",
          slackUserId: "U1",
          slackUserName: null,
          expiresAt: new Date("2026-08-12T11:00:00.000Z"),
          consumedAt: null,
        },
        now,
      ),
    ).toBe("expired");
    expect(
      resolveSlackLinkViewState(
        {
          code: "abc",
          slackTeamId: "T1",
          slackUserId: "U1",
          slackUserName: null,
          expiresAt: new Date("2026-08-12T12:15:00.000Z"),
          consumedAt: null,
        },
        now,
      ),
    ).toBe("pending");
  });
});

describe("generateSlackLinkCode", () => {
  it("generates url-safe codes", () => {
    const code = generateSlackLinkCode();
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeGreaterThan(16);
  });
});
