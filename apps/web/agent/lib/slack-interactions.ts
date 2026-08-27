import { resolveLinkedSlackPrincipal, tryCreateDbFromEnv } from "@invoicey/db";
import { renderInvoicePdf, renderIsdoc } from "@invoicey/invoice-core";
import type { Invoice } from "@invoicey/invoice-core/schema";
import {
  addCalendarDaysYmd,
  updateDraftInvoice,
} from "@invoicey/invoice-tools";
import { sendInvoiceEmailById } from "@invoicey/invoice-tools/email";
import {
  bulkDeleteDraftInvoices,
  getInvoice,
  issueInvoiceById,
  markInvoicePaidById,
} from "@invoicey/invoice-tools/ops";
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
  buildInvoiceCardModel,
  cardStateFromSummary,
  type InvoiceCardModel,
} from "./invoice-card-model";
import { buildInvoiceModelCard } from "./slack-invoice-card";
import {
  DUE_DATE_PRESETS,
  INVOICEY_ACTIONS,
  decodeSelectValue,
  isInvoiceyAction,
} from "./slack-invoice-actions";
import { appOrigin } from "./slack-thread";
import { uploadInvoiceArtifacts } from "./upload-slack-files";

/**
 * Card-button handling for Invoicey's Slack cards.
 *
 * Clicks resolve server-side against the clicker's own linked workspace and
 * run the same domain ops the tools call — the model is not in the loop. That
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

function webUrlFor(invoiceId: string): string {
  return `${appOrigin()}/invoices/${invoiceId}`;
}

/** Re-reads the invoice and rebuilds its card from the persisted truth. */
async function cardModelFor(
  invoiceId: string,
): Promise<InvoiceCardModel | null> {
  const loaded = await getInvoice({ id: invoiceId });
  if (!loaded.ok || !loaded.invoice) return null;
  return buildInvoiceCardModel({
    invoice: loaded.invoice,
    invoiceId,
    state: cardStateFromSummary(loaded.summary),
    webUrl: webUrlFor(invoiceId),
  });
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
  const model = await cardModelFor(invoiceId);
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

/** Applies one draft patch and re-renders, or reports why it did not apply. */
async function patchDraft(
  ctx: SlackInteractionContext,
  action: SlackInteractionAction,
  invoiceId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const result = await updateDraftInvoice({ id: invoiceId, patch });
  if (!result.ok) {
    const reason =
      "error" in result
        ? result.error
        : result.issues
            .map((issue) => `${issue.path}: ${issue.message}`)
            .join(", ");
    await fail(ctx, action, `Could not apply that change — ${reason}`);
    return;
  }
  await refreshCard(ctx, action, invoiceId);
}

async function handleSetDue(
  ctx: SlackInteractionContext,
  action: SlackInteractionAction,
  invoiceId: string,
  value: string,
): Promise<void> {
  const preset = DUE_DATE_PRESETS.find((option) => option.value === value);
  if (!preset) {
    await fail(ctx, action, `Unknown due-date option "${value}".`);
    return;
  }
  const loaded = await getInvoice({ id: invoiceId });
  if (!loaded.ok || !loaded.invoice) {
    await fail(ctx, action, "That invoice is no longer available.");
    return;
  }
  const dueDate = addCalendarDaysYmd(
    loaded.invoice.meta.issueDate,
    preset.days,
  );
  await patchDraft(ctx, action, invoiceId, { meta: { dueDate } });
}

async function handleIssue(
  ctx: SlackInteractionContext,
  action: SlackInteractionAction,
  invoiceId: string,
): Promise<void> {
  const result = await issueInvoiceById({ id: invoiceId });
  if (!result.ok) {
    await fail(ctx, action, `Could not issue — ${result.error}`);
    return;
  }
  await refreshCard(
    ctx,
    action,
    invoiceId,
    result.alreadyIssued
      ? "_Already issued._"
      : `:white_check_mark: Issued as *${result.invoice.meta.number}* by <@${action.user.id}>.`,
  );
  await uploadArtifacts(ctx, result.invoice);
}

async function handleMarkPaid(
  ctx: SlackInteractionContext,
  action: SlackInteractionAction,
  invoiceId: string,
): Promise<void> {
  const result = await markInvoicePaidById({ id: invoiceId });
  if (!result.ok) {
    await fail(ctx, action, `Could not mark paid — ${result.error}`);
    return;
  }
  await refreshCard(
    ctx,
    action,
    invoiceId,
    `:white_check_mark: Marked paid by <@${action.user.id}>.`,
  );
}

async function handleSendEmail(
  ctx: SlackInteractionContext,
  action: SlackInteractionAction,
  invoiceId: string,
): Promise<void> {
  const result = await sendInvoiceEmailById({ id: invoiceId });
  if (!result.ok) {
    const hint =
      result.error === "missing_recipient"
        ? "the client has no e-mail address on file — say “send it to name@example.com” instead"
        : result.error;
    await fail(ctx, action, `Could not send — ${hint}`);
    return;
  }
  await refreshCard(
    ctx,
    action,
    invoiceId,
    `:incoming_envelope: Sent to *${result.to}* by <@${action.user.id}>.`,
  );
}

async function handleDiscard(
  ctx: SlackInteractionContext,
  action: SlackInteractionAction,
  invoiceId: string,
): Promise<void> {
  const model = await cardModelFor(invoiceId);
  const result = await bulkDeleteDraftInvoices({ ids: [invoiceId] });
  if (result.ok !== 1) {
    await fail(
      ctx,
      action,
      "Could not discard that draft — it may already be issued.",
    );
    return;
  }
  await replaceCard(
    ctx,
    action.messageTs,
    Card({
      title: model
        ? `Discarded · ${model.title.split(" · ").pop()}`
        : "Discarded",
      subtitle: model?.subtitle,
      children: [CardText(`Draft discarded by <@${action.user.id}>.`)],
    }),
  );
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

  await runWithInvoiceyContext(principal, async () => {
    const { invoiceId, value } = target;
    switch (action.actionId) {
      case INVOICEY_ACTIONS.issue:
        return handleIssue(ctx, action, invoiceId);
      case INVOICEY_ACTIONS.markPaid:
        return handleMarkPaid(ctx, action, invoiceId);
      case INVOICEY_ACTIONS.sendEmail:
        return handleSendEmail(ctx, action, invoiceId);
      case INVOICEY_ACTIONS.discard:
        return handleDiscard(ctx, action, invoiceId);
      case INVOICEY_ACTIONS.previewPdf:
        return handlePreviewPdf(ctx, action, invoiceId);
      case INVOICEY_ACTIONS.setDue:
        if (!value) return;
        return handleSetDue(ctx, action, invoiceId, value);
      case INVOICEY_ACTIONS.setCurrency:
        if (!value) return;
        return patchDraft(ctx, action, invoiceId, {
          meta: { currency: value },
        });
      case INVOICEY_ACTIONS.setLanguage:
        if (!value) return;
        return patchDraft(ctx, action, invoiceId, {
          meta: { language: value },
        });
      case INVOICEY_ACTIONS.setVat: {
        if (!value) return;
        const [mode, suppliesAbroad] = value.split("|");
        if (!mode || !suppliesAbroad) return;
        return patchDraft(ctx, action, invoiceId, {
          vat: { mode, suppliesAbroad },
        });
      }
      default:
        return;
    }
  });
}
