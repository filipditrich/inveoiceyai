import { describe, expect, it } from "vitest";

import { meteringIdentityFromAuth } from "./metering-identity";

const FALLBACK = "00000000-0000-4000-8000-000000000001";

describe("meteringIdentityFromAuth", () => {
  it("drops Slack principal ids and does not fall back to the ops workspace", () => {
    const identity = meteringIdentityFromAuth(
      {
        authenticator: "slack-webhook",
        principalId: "slack:T123:U456",
        principalType: "user",
        attributes: {
          author_type: "user",
          channel_id: "C1",
          team_id: "T123",
          thread_ts: "1.2",
          user_id: "U456",
        },
      },
      FALLBACK,
    );

    expect(identity).toEqual({
      workspaceId: "",
      userId: undefined,
      slackTeamId: "T123",
      slackUserId: "U456",
      principalId: "slack:T123:U456",
    });
  });

  it("keeps Invoicey workspaceId and userId from Eve ops auth", () => {
    const identity = meteringIdentityFromAuth(
      {
        principalId: "eve:ops-api-key",
        principalType: "service",
        attributes: {
          workspaceId: "ws-from-auth",
          kind: "ops",
        },
      },
      FALLBACK,
    );

    expect(identity.workspaceId).toBe("ws-from-auth");
    expect(identity.userId).toBeUndefined();
  });

  it("accepts an explicit Invoicey userId attribute on a linked Slack session", () => {
    const identity = meteringIdentityFromAuth(
      {
        authenticator: "slack-webhook",
        principalId: "slack:T123:U456",
        principalType: "user",
        attributes: {
          workspaceId: "ws-linked",
          userId: "user_invoicey_1",
          user_id: "U456",
          team_id: "T123",
        },
      },
      FALLBACK,
    );

    expect(identity.userId).toBe("user_invoicey_1");
    expect(identity.workspaceId).toBe("ws-linked");
    expect(identity.slackUserId).toBe("U456");
  });
});
