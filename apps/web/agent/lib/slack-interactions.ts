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
  invoiceForPdfRender,
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
import { copyFor, type CardLocale } from "./invoice-card-i18n";
import {
  DUE_DATE_PRESETS,
  FIELD_TO_PATH,
  INVOICEY_ACTIONS,
  decodeButtonValue,
  decodeChangeValue,
  isInvoiceyAction,
  vatOptionFor,
  type ChangeField,
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

/**
 * Re-reads the invoice and rebuilds its card from the persisted truth.
 *
 * `assumedPaths` comes back off the clicked control. Without it a rebuilt card
 * would drop every "assumed" tag, so editing one field would quietly stop
 * flagging all the others — which is the whole point of the card.
 */
async function cardModelFor(
  invoiceId: string,
  assumedPaths: readonly string[],
): Promise<InvoiceCardModel | null> {
  const loaded = await getInvoice({ id: invoiceId });
  if (!loaded.ok || !loaded.invoice) return null;
  return buildInvoiceCardModel({
    invoice: loaded.invoice,
    invoiceId,
    state: cardStateFromSummary(loaded.summary),
    assumedPaths,
    webUrl: webUrlFor(invoiceId),
  });
}

/** Card locale, for the confirmation lines appended after an action. */
async function localeFor(invoiceId: string): Promise<CardLocale> {
  const loaded = await getInvoice({ id: invoiceId });
  return loaded.ok && loaded.invoice?.meta.language === "en" ? "en" : "cs";
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
  assumedPaths: readonly string[],
  note?: string,
): Promise<void> {
  const model = await cardModelFor(invoiceId, assumedPaths);
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
  issued: boolean,
): Promise<void> {
  const prepared = await invoiceForPdfRender(invoice, { issued });
  const pdfBytes = await renderInvoicePdf(prepared);
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
  assumedPaths: readonly string[],
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
    await fail(ctx, action, `Změnu se nepodařilo použít — ${reason}`);
    return;
  }
  await refreshCard(ctx, action, invoiceId, assumedPaths);
}

/**
 * Applies one option from the change menu.
 *
 * The path the option targets is dropped from the carried set, so the field
 * the user just chose stops being flagged while the rest stay flagged.
 */
async function handleChange(
  ctx: SlackInteractionContext,
  action: SlackInteractionAction,
  input: {
    invoiceId: string;
    assumedPaths: readonly string[];
    field: ChangeField;
    value: string;
  },
): Promise<void> {
  const { invoiceId, field, value } = input;
  const remaining = input.assumedPaths.filter(
    (path) => path !== FIELD_TO_PATH[field],
  );

  switch (field) {
    case "d": {
      const preset = DUE_DATE_PRESETS.find((option) => option.value === value);
      if (!preset) return;
      const loaded = await getInvoice({ id: invoiceId });
      if (!loaded.ok || !loaded.invoice) {
        await fail(ctx, action, "Tato faktura už není dostupná.");
        return;
      }
      const dueDate = addCalendarDaysYmd(
        loaded.invoice.meta.issueDate,
        preset.days,
      );
      return patchDraft(ctx, action, invoiceId, remaining, {
        meta: { dueDate },
      });
    }
    case "c":
      return patchDraft(ctx, action, invoiceId, remaining, {
        meta: { currency: value },
      });
    case "l":
      return patchDraft(ctx, action, invoiceId, remaining, {
        meta: { language: value },
      });
    case "v": {
      const vat = vatOptionFor(value);
      if (!vat) return;
      /** `vat.mode` shares the same field, so clear both flags. */
      return patchDraft(
        ctx,
        action,
        invoiceId,
        remaining.filter((path) => path !== "vat.mode"),
        { vat },
      );
    }
    default:
      return;
  }
}

async function handleIssue(
  ctx: SlackInteractionContext,
  action: SlackInteractionAction,
  invoiceId: string,
  assumedPaths: readonly string[],
): Promise<void> {
  const result = await issueInvoiceById({ id: invoiceId });
  if (!result.ok) {
    await fail(ctx, action, `Fakturu se nepodařilo vystavit — ${result.error}`);
    return;
  }
  const copy = copyFor(await localeFor(invoiceId));
  await refreshCard(
    ctx,
    action,
    invoiceId,
    assumedPaths,
    result.alreadyIssued
      ? copy.text.alreadyIssued
      : `:white_check_mark: ${copy.text.issuedBy} *${result.invoice.meta.number}* ${copy.text.by} <@${action.user.id}>.`,
  );
  await uploadArtifacts(ctx, result.invoice, true);
}

async function handleMarkPaid(
  ctx: SlackInteractionContext,
  action: SlackInteractionAction,
  invoiceId: string,
  assumedPaths: readonly string[],
): Promise<void> {
  const result = await markInvoicePaidById({ id: invoiceId });
  if (!result.ok) {
    await fail(
      ctx,
      action,
      `Nepodařilo se označit jako zaplacené — ${result.error}`,
    );
    return;
  }
  const copy = copyFor(await localeFor(invoiceId));
  await refreshCard(
    ctx,
    action,
    invoiceId,
    assumedPaths,
    `:white_check_mark: ${copy.text.markedPaidBy} ${copy.text.by} <@${action.user.id}>.`,
  );
}

async function handleSendEmail(
  ctx: SlackInteractionContext,
  action: SlackInteractionAction,
  invoiceId: string,
  assumedPaths: readonly string[],
): Promise<void> {
  const result = await sendInvoiceEmailById({ id: invoiceId });
  if (!result.ok) {
    const hint =
      result.error === "missing_recipient"
        ? "klient nemá uložený e-mail — napište mi „pošli to na jmeno@example.com“"
        : result.error;
    await fail(ctx, action, `Nepodařilo se odeslat — ${hint}`);
    return;
  }
  const copy = copyFor(await localeFor(invoiceId));
  await refreshCard(
    ctx,
    action,
    invoiceId,
    assumedPaths,
    `:incoming_envelope: ${copy.text.sentTo} *${result.to}* ${copy.text.by} <@${action.user.id}>.`,
  );
}

async function handleDiscard(
  ctx: SlackInteractionContext,
  action: SlackInteractionAction,
  invoiceId: string,
): Promise<void> {
  const locale = await localeFor(invoiceId);
  const copy = copyFor(locale);
  const model = await cardModelFor(invoiceId, []);
  const result = await bulkDeleteDraftInvoices({ ids: [invoiceId] });
  if (result.ok !== 1) {
    await fail(
      ctx,
      action,
      "Návrh se nepodařilo zahodit — možná už je vystavený.",
    );
    return;
  }
  await replaceCard(
    ctx,
    action.messageTs,
    Card({
      title: model
        ? `${copy.text.discarded} · ${model.title.split(" · ").pop()}`
        : copy.text.discarded,
      subtitle: model?.subtitle,
      children: [CardText(`${copy.text.discardedBy} <@${action.user.id}>.`)],
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
    await fail(ctx, action, "Tato faktura už není dostupná.");
    return;
  }
  await uploadArtifacts(ctx, loaded.invoice, Boolean(loaded.summary.issuedAt));
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

  const change = decodeChangeValue(action.selectedOptionValue);
  const button = decodeButtonValue(action.value ?? undefined);
  const invoiceId = change?.invoiceId ?? button?.invoiceId;
  const assumedPaths = change?.assumedPaths ?? button?.assumedPaths ?? [];

  if (!invoiceId) {
    await fail(ctx, action, "Tomuto tlačítku chybí odkaz na fakturu.");
    return;
  }

  const principal = await resolveClicker(action, ctx);
  if (!principal) {
    await fail(
      ctx,
      action,
      "Váš účet Slacku není propojený s Invoicey, akce se neprovedla. Zmiňte mě a pošlu vám nový odkaz.",
    );
    return;
  }

  await runWithInvoiceyContext(principal, async () => {
    switch (action.actionId) {
      case INVOICEY_ACTIONS.change:
        if (!change) return;
        return handleChange(ctx, action, change);
      case INVOICEY_ACTIONS.issue:
        return handleIssue(ctx, action, invoiceId, assumedPaths);
      case INVOICEY_ACTIONS.markPaid:
        return handleMarkPaid(ctx, action, invoiceId, assumedPaths);
      case INVOICEY_ACTIONS.sendEmail:
        return handleSendEmail(ctx, action, invoiceId, assumedPaths);
      case INVOICEY_ACTIONS.discard:
        return handleDiscard(ctx, action, invoiceId);
      case INVOICEY_ACTIONS.previewPdf:
        return handlePreviewPdf(ctx, action, invoiceId);
      default:
        return;
    }
  });
}
