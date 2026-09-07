import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import {
  callSlackApi,
  cardToBlocks,
  cardToFallbackText,
  type CardElement,
} from "eve/channels/slack";

import { slackIdentities } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import type { EmailLocale } from "@invoicey/emails";

import type { PaymentNotificationRecipient } from "./notify-recipients";
import {
  buildPaymentProposalCard,
  buildUnmatchedPaymentsCard,
  type SlackPaymentProposal,
  type SlackPaymentUnmatched,
} from "./slack-payment-card";

/**
 * Opens the bot's IM with one user and posts a card there.
 *
 * Slack's `chat.postMessage` cannot address a user id directly, so the IM
 * channel has to be opened first. Both calls return `ok: false` rather than
 * throwing, which is why the result is inspected explicitly.
 */
async function postDirectMessage(input: {
  slackUserId: string;
  card: CardElement;
}): Promise<boolean> {
  const opened = await callSlackApi({
    botToken: undefined,
    operation: "conversations.open",
    body: { users: input.slackUserId },
  });
  // SAFETY: `callSlackApi` returns Slack's raw JSON envelope as `unknown`
  // fields. `conversations.open` documents `channel.id`, and the `ok` check
  // below rejects the response when Slack did not supply one.
  const channelId = (opened.channel as { id?: string } | undefined)?.id;
  if (!opened.ok || !channelId) {
    console.error("[payment-review] conversations.open failed", opened.error);
    return false;
  }
  const posted = await callSlackApi({
    botToken: undefined,
    operation: "chat.postMessage",
    body: {
      channel: channelId,
      blocks: cardToBlocks(input.card),
      text: cardToFallbackText(input.card),
    },
  });
  if (!posted.ok) {
    console.error("[payment-review] chat.postMessage failed", posted.error);
    return false;
  }
  return true;
}

/**
 * DMs each linked reviewer the same proposals the digest email lists.
 *
 * Slack is where these decisions actually get made — an invoice card there
 * already carries Issue, Mark paid and Send, so a payment that needs one yes
 * or no belongs on the same surface. Delivery is best-effort by design: Slack
 * being unreachable must never cost the workspace its email.
 *
 * Amounts and dates arrive already formatted. The caller has to format them
 * for the email anyway, and rendering the same payment twice from two copies
 * of the same `Intl` setup is how the two surfaces drift apart.
 */
export async function postPaymentReviewSlackCards(input: {
  workspaceId: string;
  recipients: readonly PaymentNotificationRecipient[];
  proposals: readonly SlackPaymentProposal[];
  unmatched: readonly SlackPaymentUnmatched[];
  locale: EmailLocale;
  paymentsUrl: string;
}): Promise<number> {
  if (input.recipients.length === 0) return 0;
  if (!process.env.SLACK_BOT_TOKEN) return 0;

  const identities = await db
    .select({
      userId: slackIdentities.userId,
      slackUserId: slackIdentities.slackUserId,
    })
    .from(slackIdentities)
    .where(
      and(
        eq(slackIdentities.workspaceId, input.workspaceId),
        inArray(
          slackIdentities.userId,
          input.recipients.map((recipient) => recipient.userId),
        ),
      ),
    );
  if (identities.length === 0) return 0;

  const cards: CardElement[] = input.proposals.map((proposal) =>
    buildPaymentProposalCard({ proposal, locale: input.locale }),
  );
  if (input.unmatched.length > 0) {
    cards.push(
      buildUnmatchedPaymentsCard({
        locale: input.locale,
        paymentsUrl: input.paymentsUrl,
        unmatched: input.unmatched,
      }),
    );
  }

  let delivered = 0;
  for (const identity of identities) {
    for (const card of cards) {
      try {
        if (
          await postDirectMessage({ slackUserId: identity.slackUserId, card })
        ) {
          delivered += 1;
        }
      } catch (error) {
        console.error("[payment-review] slack dm failed", error);
      }
    }
  }
  return delivered;
}
