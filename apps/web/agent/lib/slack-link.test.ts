import { describe, expect, it } from "vitest";

import {
  SLACK_LINK_CHANNEL_NOTICE,
  buildSlackLinkChannelCard,
  buildSlackLinkDmCard,
  slackLinkChannelFallback,
  slackLinkDmText,
  slackLinkUrl,
} from "./slack-link";

describe("slack link delivery copy", () => {
  it("keeps the one-shot URL out of the channel notice and card", () => {
    const url = slackLinkUrl("secret-code");
    expect(url).toContain("/slack/link/secret-code");
    expect(SLACK_LINK_CHANNEL_NOTICE).not.toContain("/slack/link/");
    expect(slackLinkChannelFallback("U123")).not.toContain("/slack/link/");
    expect(JSON.stringify(buildSlackLinkChannelCard())).not.toContain(
      "/slack/link/",
    );
    expect(slackLinkDmText({ url, reason: "unlinked" })).toContain(url);
  });

  it("puts the confirm URL on the DM card button, not as raw body copy", () => {
    const url = slackLinkUrl("secret-code");
    const card = buildSlackLinkDmCard({ url, reason: "unlinked" });
    expect(JSON.stringify(card)).toContain(url);
    expect(card.title).toBe("Connect Invoicey");
    const channel = buildSlackLinkChannelCard();
    expect(channel.title).toBe("Check your DMs");
    expect(JSON.stringify(channel)).not.toContain(url);
  });
});
