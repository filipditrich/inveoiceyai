import { describe, expect, it } from "vitest";

import {
  SLACK_LINK_CHANNEL_NOTICE,
  slackLinkDmText,
  slackLinkUrl,
} from "./slack-link";

describe("slack link delivery copy", () => {
  it("keeps the one-shot URL out of the channel notice", () => {
    const url = slackLinkUrl("secret-code");
    expect(url).toContain("/slack/link/secret-code");
    expect(SLACK_LINK_CHANNEL_NOTICE).not.toContain("/slack/link/");
    expect(slackLinkDmText({ url, reason: "unlinked" })).toContain(url);
  });
});
