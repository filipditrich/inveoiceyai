import {
  createOrReuseSlackLinkCode,
  tryCreateDbFromEnv,
  type InvoiceyDb,
} from "@invoicey/db";

import { appOrigin } from "./slack-thread";

export type SlackLinkThread = {
  post: (message: string) => Promise<unknown>;
  postDirectMessage: (userId: string, message: string) => Promise<unknown>;
  postEphemeral: (userId: string, message: string) => Promise<unknown>;
};

export function slackLinkUrl(code: string): string {
  return `${appOrigin()}/slack/link/${encodeURIComponent(code)}`;
}

export function slackLinkDmText(input: {
  url: string;
  reason: "unlinked" | "not_member";
}): string {
  const intro =
    input.reason === "not_member"
      ? "You are no longer a member of the Invoicey workspace linked to this Slack account. Re-link to a workspace you belong to:"
      : "Link this Slack account to Invoicey before I can draft or look up invoices:";
  return [
    intro,
    "",
    input.url,
    "",
    "The link expires in 15 minutes and works once. Confirm in the browser — I will not match Slack and Invoicey by email.",
  ].join("\n");
}

export const SLACK_LINK_CHANNEL_NOTICE =
  "I sent you a DM to link Invoicey. I cannot invoice until that is confirmed.";

/** Mint or reuse a 15-minute code and DM the URL. Never post the URL in a channel. */
export async function deliverSlackLinkInvite(input: {
  db?: InvoiceyDb | null;
  thread: SlackLinkThread;
  isDirectMessage: boolean;
  slackTeamId: string;
  slackUserId: string;
  slackUserName?: string | null;
  reason: "unlinked" | "not_member";
}): Promise<void> {
  const database = input.db ?? tryCreateDbFromEnv();
  if (!database) {
    const text =
      "Invoicey is not connected to a database, so I cannot link Slack accounts. Ask the operator to set DATABASE_URL.";
    await input.thread.post(text);
    return;
  }

  const row = await createOrReuseSlackLinkCode(database, {
    slackTeamId: input.slackTeamId,
    slackUserId: input.slackUserId,
    slackUserName: input.slackUserName,
  });
  const text = slackLinkDmText({
    url: slackLinkUrl(row.code),
    reason: input.reason,
  });

  if (input.isDirectMessage) {
    await input.thread.post(text);
    return;
  }

  try {
    await input.thread.postDirectMessage(input.slackUserId, text);
    await input.thread.post(SLACK_LINK_CHANNEL_NOTICE);
    return;
  } catch {
    /** fall through to ephemeral */
  }

  try {
    await input.thread.postEphemeral(input.slackUserId, text);
  } catch {
    /** never post the one-shot URL in a shared channel */
    await input.thread.post(SLACK_LINK_CHANNEL_NOTICE);
  }
}
