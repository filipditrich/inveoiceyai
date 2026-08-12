import {
  resolveLinkedSlackPrincipal,
  tryCreateDbFromEnv,
  type InvoiceyDb,
} from "@invoicey/db";
import {
  defaultSlackAuth,
  type SlackInboundMessageContext,
  type SlackInboundResult,
  type SlackMessage,
} from "eve/channels/slack";

import {
  overlayInvoiceyIdentity,
  slackDisplayNameFromAuth,
  slackIdsFromAuth,
} from "./slack-identity";
import { deliverSlackLinkInvite } from "./slack-link";

/**
 * Shared Slack dispatch gate. Eve's default `onAppMention` / `onDirectMessage`
 * start a turn with workspace-scoped auth and skip `onMessage`, so mentions
 * must use this helper or unlinked callers reach the model and crash metering.
 */
export async function handleSlackInbound(
  ctx: SlackInboundMessageContext,
  message: SlackMessage,
  options: { alwaysHandle: boolean },
  db?: InvoiceyDb | null,
): Promise<SlackInboundResult> {
  if (message.author?.isBot) return null;
  const isDirectMessage = message.raw.channel_type === "im";
  if (!options.alwaysHandle) {
    const shouldHandle =
      isDirectMessage || ctx.isBotMentioned() || (await ctx.isSubscribed());
    if (!shouldHandle) return null;
  }

  await ctx.cancel();
  const auth = defaultSlackAuth(message, ctx);
  if (!auth) return null;

  const ids = slackIdsFromAuth(auth);
  if (!ids) {
    await ctx.thread.post(
      "I could not identify this Slack user, so I cannot start an Invoicey session.",
    );
    return null;
  }

  const database = db !== undefined ? db : tryCreateDbFromEnv();
  const principal = database
    ? await resolveLinkedSlackPrincipal(database, ids)
    : { status: "unlinked" as const };

  if (principal.status === "linked") {
    return {
      auth: overlayInvoiceyIdentity(auth, principal.identity),
    };
  }

  await deliverSlackLinkInvite({
    db: database,
    thread: ctx.thread,
    isDirectMessage,
    slackTeamId: ids.slackTeamId,
    slackUserId: ids.slackUserId,
    slackUserName: slackDisplayNameFromAuth(auth),
    reason: principal.status,
  });
  return null;
}
