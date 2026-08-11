import { describe, expect, it } from "vitest";

import { resolveInvitationViewState } from "./invitation-view-state";

describe("resolveInvitationViewState", () => {
  const base = {
    email: "friend@example.com",
    status: "pending",
    expiresAt: new Date(Date.now() + 60_000),
  };

  it("returns pending when email matches and not expired", () => {
    expect(
      resolveInvitationViewState({
        invitation: base,
        signedInEmail: "Friend@example.com",
      }),
    ).toBe("pending");
  });

  it("returns email_mismatch when signed-in email differs", () => {
    expect(
      resolveInvitationViewState({
        invitation: base,
        signedInEmail: "other@example.com",
      }),
    ).toBe("email_mismatch");
  });

  it("returns expired when past expiresAt", () => {
    expect(
      resolveInvitationViewState({
        invitation: {
          ...base,
          expiresAt: new Date(Date.now() - 1000),
        },
        signedInEmail: "friend@example.com",
      }),
    ).toBe("expired");
  });

  it("returns unavailable for non-pending status", () => {
    expect(
      resolveInvitationViewState({
        invitation: { ...base, status: "canceled" },
        signedInEmail: "friend@example.com",
      }),
    ).toBe("unavailable");
  });
});
