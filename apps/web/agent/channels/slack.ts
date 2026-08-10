import { connectSlackCredentials } from "@vercel/connect/eve";
import { defaultSlackAuth, slackChannel } from "eve/channels/slack";

import { SLACK_CONNECT_UID } from "../lib/slack-connect";

export default slackChannel({
  credentials: connectSlackCredentials(SLACK_CONNECT_UID),
  threadContext: { since: "last-agent-reply" },
  async onMessage(ctx, message) {
    if (message.author?.isBot) return null;
    const isDirectMessage = message.raw.channel_type === "im";
    const shouldHandle =
      isDirectMessage ||
      ctx.isBotMentioned() ||
      (await ctx.isSubscribed());
    if (!shouldHandle) return null;
    await ctx.cancel();
    const auth = defaultSlackAuth(message, ctx);
    return auth ? { auth } : null;
  },
});
