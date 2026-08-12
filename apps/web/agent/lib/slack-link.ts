import {
  Actions,
  Card,
  Field,
  Fields,
  LinkButton,
  type CardElement,
  type SlackPostInput,
} from "eve/channels/slack";

import {
  createOrReuseSlackLinkCode,
  tryCreateDbFromEnv,
  type InvoiceyDb,
} from "@invoicey/db";

import { appOrigin } from "./slack-thread";

export type SlackLinkMessage = string | CardElement | SlackPostInput;

export type SlackLinkThread = {
  post: (message: SlackLinkMessage) => Promise<unknown>;
  postDirectMessage: (
    userId: string,
    message: SlackLinkMessage,
  ) => Promise<unknown>;
  postEphemeral: (
    userId: string,
    message: SlackLinkMessage,
  ) => Promise<unknown>;
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
    `Confirm in Invoicey (expires in 15 minutes, one-time): ${input.url}`,
    "",
    "I will not match Slack and Invoicey by email.",
  ].join("\n");
}

export const SLACK_LINK_CHANNEL_NOTICE =
  "I sent you a DM to link Invoicey. Open it, confirm in the browser, then ask again.";

export function slackLinkChannelFallback(slackUserId: string): string {
  return `<@${slackUserId}> ${SLACK_LINK_CHANNEL_NOTICE}`;
}

export function buildSlackLinkDmCard(input: {
  url: string;
  reason: "unlinked" | "not_member";
  slackUserName?: string | null;
}): CardElement {
  const name = input.slackUserName?.trim();
  const title =
    input.reason === "not_member" ? "Re-link Invoicey" : "Connect Invoicey";
  const subtitle = name
    ? `Hi ${name} — confirm this Slack account in the browser.`
    : "Confirm this Slack account in the browser before I can invoice.";
  return Card({
    title,
    subtitle,
    children: [
      Fields([
        Field({ label: "Expires", value: "15 minutes" }),
        Field({ label: "Uses", value: "Once" }),
        Field({
          label: "Matching",
          value: "Never by email — you confirm in Invoicey",
        }),
      ]),
      Actions([
        LinkButton({
          url: input.url,
          label: "Confirm in Invoicey",
          style: "primary",
        }),
      ]),
    ],
  });
}

export function buildSlackLinkChannelCard(): CardElement {
  return Card({
    title: "Check your DMs",
    subtitle:
      "I cannot draft or look up invoices until this Slack account is linked.",
    children: [
      Fields([
        Field({
          label: "Next step",
          value: "Open the private message from Invoicey",
        }),
        Field({
          label: "Then",
          value: "Come back here and ask again",
        }),
      ]),
    ],
  });
}

function slackLinkDmPost(input: {
  url: string;
  reason: "unlinked" | "not_member";
  slackUserName?: string | null;
}): SlackPostInput {
  return {
    card: buildSlackLinkDmCard(input),
    fallbackText: slackLinkDmText(input),
  };
}

function slackLinkChannelPost(slackUserId: string): SlackPostInput {
  return {
    card: buildSlackLinkChannelCard(),
    fallbackText: slackLinkChannelFallback(slackUserId),
  };
}

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
  const dm = slackLinkDmPost({
    url: slackLinkUrl(row.code),
    reason: input.reason,
    slackUserName: input.slackUserName ?? row.slackUserName,
  });
  const channel = slackLinkChannelPost(input.slackUserId);

  if (input.isDirectMessage) {
    await input.thread.post(dm);
    return;
  }

  try {
    await input.thread.postDirectMessage(input.slackUserId, dm);
    await input.thread.post(channel);
    return;
  } catch {
    /** fall through to ephemeral */
  }

  try {
    await input.thread.postEphemeral(input.slackUserId, dm);
  } catch {
    /** never post the one-shot URL in a shared channel */
    await input.thread.post(channel);
  }
}
