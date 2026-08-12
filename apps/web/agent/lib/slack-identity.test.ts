import { describe, expect, it } from "vitest";

import {
  overlayInvoiceyIdentity,
  resolveSlackToolPrincipal,
  slackIdsFromAuth,
  slackToolAuthError,
} from "./slack-identity";

describe("slackToolAuthError", () => {
  it("fails closed when Slack auth has no Invoicey workspaceId", () => {
    expect(
      slackToolAuthError({
        authenticator: "slack-webhook",
        principalId: "slack:T1:U1",
        attributes: { team_id: "T1", user_id: "U1" },
      }),
    ).toBe("not_linked");
  });

  it("fails closed when Slack auth has workspaceId but no Invoicey userId", () => {
    expect(
      slackToolAuthError({
        authenticator: "slack-webhook",
        principalId: "slack:T1:U1",
        attributes: { workspaceId: "ws-1", team_id: "T1", user_id: "U1" },
      }),
    ).toBe("not_linked");
  });

  it("allows a linked Slack overlay", () => {
    expect(
      slackToolAuthError({
        authenticator: "slack-webhook",
        principalId: "slack:T1:U1",
        attributes: {
          workspaceId: "ws-1",
          userId: "user-1",
          team_id: "T1",
          user_id: "U1",
        },
      }),
    ).toBeNull();
  });

  it("does not gate Eve HTTP ops auth", () => {
    expect(
      slackToolAuthError({
        authenticator: "api-key",
        principalId: "eve:ops-api-key",
        attributes: { workspaceId: "ops-ws", kind: "ops" },
      }),
    ).toBeNull();
  });
});

describe("overlayInvoiceyIdentity", () => {
  it("adds Invoicey ids without replacing the Slack principal", () => {
    const overlaid = overlayInvoiceyIdentity(
      {
        authenticator: "slack-webhook",
        principalId: "slack:T1:U1",
        attributes: { team_id: "T1", user_id: "U1" },
      },
      { userId: "user-1", workspaceId: "ws-1" },
    );

    expect(overlaid.principalId).toBe("slack:T1:U1");
    expect(overlaid.attributes).toMatchObject({
      team_id: "T1",
      user_id: "U1",
      userId: "user-1",
      workspaceId: "ws-1",
    });
  });
});

describe("slackIdsFromAuth", () => {
  it("reads Slack team and user from defaultSlackAuth attributes", () => {
    expect(
      slackIdsFromAuth({
        attributes: { team_id: "T9", user_id: "U8" },
      }),
    ).toEqual({ slackTeamId: "T9", slackUserId: "U8" });
  });
});

describe("resolveSlackToolPrincipal", () => {
  const slackCurrent = {
    authenticator: "slack-webhook",
    principalId: "slack:T1:U1",
    attributes: { team_id: "T1", user_id: "U1" },
  };

  it("uses Invoicey overlay on current when present", async () => {
    const lookup = async () => {
      throw new Error("lookup should not run");
    };
    const result = await resolveSlackToolPrincipal(
      {
        current: overlayInvoiceyIdentity(slackCurrent, {
          userId: "user-1",
          workspaceId: "ws-1",
        }),
      },
      lookup,
    );
    expect(result).toEqual({
      status: "linked",
      identity: {
        userId: "user-1",
        workspaceId: "ws-1",
        slackTeamId: "T1",
        slackUserId: "U1",
      },
    });
  });

  it("looks up slack_identities when HITL auth has Slack ids but no overlay", async () => {
    const result = await resolveSlackToolPrincipal(
      { current: slackCurrent },
      async (ids) => {
        expect(ids).toEqual({ slackTeamId: "T1", slackUserId: "U1" });
        return {
          status: "linked",
          identity: {
            userId: "user-1",
            workspaceId: "ws-1",
            slackTeamId: ids.slackTeamId,
            slackUserId: ids.slackUserId,
          },
        };
      },
    );
    expect(result.status).toBe("linked");
    if (result.status === "linked") {
      expect(result.identity.workspaceId).toBe("ws-1");
      expect(result.identity.userId).toBe("user-1");
    }
  });

  it("stays fail-closed when the Slack account is not in slack_identities", async () => {
    const result = await resolveSlackToolPrincipal(
      { current: slackCurrent },
      async () => ({ status: "unlinked" }),
    );
    expect(result).toEqual({ status: "unlinked" });
  });
});
