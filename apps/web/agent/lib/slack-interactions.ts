import { resolveLinkedSlackPrincipal, tryCreateDbFromEnv } from "@invoicey/db";
import { renderInvoicePdf, renderIsdoc } from "@invoicey/invoice-core";
import type { Invoice } from "@invoicey/invoice-core/schema";
import { getInvoice } from "@invoicey/invoice-tools/ops";
import { runWithInvoiceyContext } from "@invoicey/invoice-tools/workspace-context";
import {
  Card,
  CardText,
  cardToBlocks,
  cardToFallbackText,
  type CardElement,
  type SlackInteractionAction,
  type SlackInteractionContext,
} from "eve/channels/slack";

import {
  invoiceCardModelFor,
  runInvoiceCardAction,
  type InvoiceCardActionId,
  type InvoiceCardActionResult,
} from "./invoice-card-actions";
import { buildInvoiceModelCard } from "./slack-invoice-card";
import {
  INVOICEY_ACTIONS,
  decodeSelectValue,
  isInvoiceyAction,
} from "./slack-invoice-actions";
import { uploadInvoiceArtifacts } from "./upload-slack-files";

/**
 * Slack rendering for Invoicey's review-card controls.
 *
 * What a click *does* lives in `invoice-card-actions.ts`, shared with the
 * in-app assistant panel; this file only resolves the clicker, hands the action
 * over, and paints the result back into the thread. Clicks resolve server-side
 * against the clicker's own linked workspace — the model is not in the loop. That
 * is the point: a click on a card that already shows number, client and total
 * is a more specific act of consent than a sentence the model has to
 * re-interpret, and it costs no tokens and no extra turn.
 *
 * Draft-mutating clicks are reversible and run straight through. `Issue`,
 * `Mark paid` and `Send to client` are not reversible, so they only appear on
 * a card that displays what they will act on, and each re-checks workspace
 * membership before touching anything.
 */

type WorkspacePrincipal = { workspaceId: string; userId: string };

async function resolveClicker(
  action: SlackInteractionAction,
  ctx: SlackInteractionContext,
): Promise<WorkspacePrincipal | null> {
  const database = tryCreateDbFromEnv();
  const teamId = ctx.slack.teamId;
  if (!database || !teamId) return null;
  const principal = await resolveLinkedSlackPrincipal(database, {
    slackTeamId: teamId,
    slackUserId: action.user.id,
  });
  if (principal.status !== "linked") return null;
  return {
    workspaceId: principal.identity.workspaceId,
    userId: principal.identity.userId,
  };
}

/**
 * Replaces the clicked card in place.
 *
 * Editing the same message rather than posting a new one is what keeps a
 * thread with five adjustments readable: there is exactly one card per
 * invoice, and it always shows current state.
 */
async function replaceCard(
  ctx: SlackInteractionContext,
  messageTs: string | undefined,
  card: CardElement,
): Promise<void> {
  if (!messageTs) return;
  await ctx.slack.request("chat.update", {
    channel: ctx.slack.channelId,
    ts: messageTs,
    blocks: cardToBlocks(card),
    text: cardToFallbackText(card),
  });
}

async function refreshCard(
  ctx: SlackInteractionContext,
  action: SlackInteractionAction,
  invoiceId: string,
  note?: string,
): Promise<void> {
  const model = await invoiceCardModelFor(invoiceId);
  if (!model) return;
  const card = buildInvoiceModelCard(model);
  if (note) card.children.push(CardText(note));
  await replaceCard(ctx, action.messageTs, card);
}

/** Private failure feedback — a bad click should not shout in the channel. */
async function fail(
  ctx: SlackInteractionContext,
  action: SlackInteractionAction,
  message: string,
): Promise<void> {
  await ctx.thread.postEphemeral(action.user.id, message);
}

async function uploadArtifacts(
  ctx: SlackInteractionContext,
  invoice: Invoice,
): Promise<void> {
  const pdfBytes = await renderInvoicePdf(invoice);
  const isdocXml = renderIsdoc(invoice);
  const safeName = invoice.meta.number.replace(/[^\w.-]+/gu, "_");
  await uploadInvoiceArtifacts({
    channelId: ctx.slack.channelId,
    threadTs: ctx.slack.threadTs,
    filenamePdf: `faktura-${safeName}-isdoc.pdf`,
    filenameIsdoc: `faktura-${safeName}.isdoc`,
    pdfBase64: Buffer.from(pdfBytes).toString("base64"),
    isdocXml,
  });
}

/** Emoji is Slack's own register; the shared action layer returns plain notes. */
const NOTE_EMOJI: Partial<Record<InvoiceCardActionId, string>> = {
  issue: ":white_check_mark:",
  mark_paid: ":white_check_mark:",
  send_email: ":incoming_envelope:",
};

/** Runs one card control and paints the result back over the clicked card. */
async function runAction(
  ctx: SlackInteractionContext,
  action: SlackInteractionAction,
  id: InvoiceCardActionId,
  invoiceId: string,
  principal: WorkspacePrincipal,
  value?: string | null,
): Promise<void> {
  const result = await runInvoiceCardAction({
    action: id,
    invoiceId,
    value,
    principal,
    actorLabel: `<@${action.user.id}>`,
  });
  await applyResult(ctx, action, id, invoiceId, result);
}

async function applyResult(
  ctx: SlackInteractionContext,
  action: SlackInteractionAction,
  id: InvoiceCardActionId,
  invoiceId: string,
  result: InvoiceCardActionResult,
): Promise<void> {
  if (!result.ok) {
    await fail(ctx, action, result.message);
    return;
  }

  if (result.kind === "discarded") {
    await replaceCard(
      ctx,
      action.messageTs,
      Card({
        title: `Discarded · ${result.title}`,
        children: [CardText(`Draft discarded by <@${action.user.id}>.`)],
      }),
    );
    return;
  }

  const card = buildInvoiceModelCard(result.card);
  if (result.note) {
    const emoji = NOTE_EMOJI[id];
    card.children.push(
      CardText(emoji ? `${emoji} ${result.note}` : `_${result.note}_`),
    );
  }
  await replaceCard(ctx, action.messageTs, card);

  /** Issuing freezes the document, so this is the PDF worth keeping in-thread. */
  if (id === "issue") {
    const loaded = await getInvoice({ id: invoiceId });
    if (loaded.ok && loaded.invoice) {
      await uploadArtifacts(ctx, loaded.invoice);
    }
  }
}

async function handlePreviewPdf(
  ctx: SlackInteractionContext,
  action: SlackInteractionAction,
  invoiceId: string,
): Promise<void> {
  const loaded = await getInvoice({ id: invoiceId });
  if (!loaded.ok || !loaded.invoice) {
    await fail(ctx, action, "That invoice is no longer available.");
    return;
  }
  await uploadArtifacts(ctx, loaded.invoice);
}

/** Splits a click into `{ invoiceId, value }` for both buttons and selects. */
function targetOf(
  action: SlackInteractionAction,
): { invoiceId: string; value: string | null } | null {
  const selected = decodeSelectValue(action.selectedOptionValue);
  if (selected) {
    return { invoiceId: selected.invoiceId, value: selected.value };
  }
  const buttonValue = action.value?.trim();
  if (buttonValue) return { invoiceId: buttonValue, value: null };
  return null;
}

/**
 * Entry point wired to `slackChannel({ onInteraction })`.
 *
 * Returns silently for anything outside the `invoicey:` namespace so Eve's own
 * HITL widgets and any future handler keep working untouched.
 */
export async function handleInvoiceyInteraction(
  action: SlackInteractionAction,
  ctx: SlackInteractionContext,
): Promise<void> {
  if (!isInvoiceyAction(action.actionId)) return;
  /** A URL button still reports a click; opening the link is the whole effect. */
  if (action.actionId === INVOICEY_ACTIONS.openWeb) return;

  const target = targetOf(action);
  if (!target) {
    await fail(ctx, action, "That button is missing its invoice reference.");
    return;
  }

  const principal = await resolveClicker(action, ctx);
  if (!principal) {
    await fail(
      ctx,
      action,
      "Your Slack account is not linked to an Invoicey workspace, so this action was not run. Mention me to get a fresh link.",
    );
    return;
  }

  const { invoiceId, value } = target;

  /** `Preview PDF` has no domain effect — it only puts files in the thread. */
  if (action.actionId === INVOICEY_ACTIONS.previewPdf) {
    await runWithInvoiceyContext(principal, () =>
      handlePreviewPdf(ctx, action, invoiceId),
    );
    return;
  }

  const id = CARD_ACTION_BY_SLACK_ID[action.actionId];
  if (!id) return;
  await runAction(ctx, action, id, invoiceId, principal, value);
}

/** Slack's action-id namespace mapped onto the shared, surface-free action ids. */
const CARD_ACTION_BY_SLACK_ID: Record<string, InvoiceCardActionId | undefined> =
  {
    [INVOICEY_ACTIONS.issue]: "issue",
    [INVOICEY_ACTIONS.markPaid]: "mark_paid",
    [INVOICEY_ACTIONS.sendEmail]: "send_email",
    [INVOICEY_ACTIONS.discard]: "discard",
    [INVOICEY_ACTIONS.setDue]: "set_due",
    [INVOICEY_ACTIONS.setCurrency]: "set_currency",
    [INVOICEY_ACTIONS.setVat]: "set_vat",
    [INVOICEY_ACTIONS.setLanguage]: "set_language",
  };
