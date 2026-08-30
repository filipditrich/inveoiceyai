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

import { copyFor, type CardLocale } from "./invoice-card-i18n";
import {
  buildInvoiceCardModel,
  cardStateFromSummary,
  type InvoiceCardModel,
} from "./invoice-card-model";
import {
  DUE_DATE_PRESETS,
  FIELD_TO_PATH,
  vatOptionFor,
  type ChangeField,
} from "./slack-invoice-actions";
import { appOrigin } from "./slack-thread";

/**
 * What a review-card control does for the in-app assistant panel.
 *
 * The vocabulary is Slack's — one `change` menu keyed by {@link ChangeField},
 * plus the lifecycle buttons — because the card model, its option codes and its
 * copy are already shared. The panel therefore posts the same field and value a
 * Slack option carries, and both surfaces mean the same thing by a click.
 *
 * `slack-interactions.ts` still owns its own copy of these effects. Collapsing
 * the two is worth doing, but it has to happen without disturbing the Slack
 * handler's thread-bound concerns (ephemeral errors, in-place card edits, file
 * uploads), so it is deliberately left as a follow-up rather than smuggled into
 * this one.
 *
 * The model is deliberately not in this loop. A click on a card that already
 * shows number, client and total is a more specific act of consent than a
 * sentence the model has to re-interpret, and it costs no tokens and no turn.
 */
export const INVOICE_CARD_ACTIONS = [
  "issue",
  "mark_paid",
  "send_email",
  "discard",
  "change",
] as const;

export type InvoiceCardActionId = (typeof INVOICE_CARD_ACTIONS)[number];

export function isInvoiceCardActionId(
  value: string,
): value is InvoiceCardActionId {
  return (INVOICE_CARD_ACTIONS as readonly string[]).includes(value);
}

export type InvoiceCardActionResult =
  /** The invoice still exists: render `card`, optionally with `note` under it. */
  | { ok: true; kind: "card"; card: InvoiceCardModel; note?: string }
  /** The draft is gone; there is nothing left to render. */
  | { ok: true; kind: "discarded"; invoiceId: string; title: string }
  | { ok: false; message: string };

export interface InvoiceCardActionInput {
  action: InvoiceCardActionId;
  invoiceId: string;
  /**
   * Draft paths still standing on a default, carried from the card that was
   * clicked. Without it a rebuilt card drops every "assumed" tag, so editing
   * one field would quietly stop flagging all the others.
   */
  assumedPaths?: readonly string[];
  /** `change` only: which field the option targets. */
  field?: ChangeField;
  value?: string | null;
  principal: { workspaceId: string; userId: string };
  /** Names the actor in the confirmation note, already surface-formatted. */
  actorLabel?: string;
}

/**
 * Failure copy.
 *
 * Kept in step with the Slack handler, which reports failures in Czech
 * regardless of the card's own locale — a mismatch worth fixing in one place
 * later rather than diverging here.
 */
const FAILED = {
  gone: "Tato faktura už není dostupná.",
  change: "Změnu se nepodařilo použít",
  issue: "Fakturu se nepodařilo vystavit",
  markPaid: "Nepodařilo se označit jako zaplacené",
  send: "Odeslání se nepodařilo",
  discard: "Návrh se nepodařilo zahodit — možná je už vystavený.",
  missingRecipient:
    "klient nemá uvedený e-mail — napište mi „pošli to na jmeno@example.com“",
} as const;

function webUrlFor(invoiceId: string): string {
  return `${appOrigin()}/invoices/${invoiceId}`;
}

/** Re-reads the invoice and rebuilds its card from the persisted truth. */
export async function invoiceCardModelFor(
  invoiceId: string,
  assumedPaths: readonly string[] = [],
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

async function refreshed(
  invoiceId: string,
  assumedPaths: readonly string[],
  note?: string,
): Promise<InvoiceCardActionResult> {
  const card = await invoiceCardModelFor(invoiceId, assumedPaths);
  if (!card) return { ok: false, message: FAILED.gone };
  return { ok: true, kind: "card", card, note };
}

function by(actorLabel: string | undefined, byWord: string): string {
  return actorLabel ? ` ${byWord} ${actorLabel}` : "";
}

async function patchDraft(
  invoiceId: string,
  assumedPaths: readonly string[],
  patch: Record<string, unknown>,
): Promise<InvoiceCardActionResult> {
  const result = await updateDraftInvoice({ id: invoiceId, patch });
  if (!result.ok) {
    const reason =
      "error" in result
        ? result.error
        : result.issues
            .map((issue) => `${issue.path}: ${issue.message}`)
            .join(", ");
    return { ok: false, message: `${FAILED.change} — ${reason}` };
  }
  return refreshed(invoiceId, assumedPaths);
}

/**
 * Applies one option from the change menu.
 *
 * The path the option targets drops out of the carried set, so the field the
 * user just chose stops being flagged while the rest stay flagged.
 */
async function applyChange(
  invoiceId: string,
  carried: readonly string[],
  field: ChangeField,
  value: string,
): Promise<InvoiceCardActionResult> {
  const remaining = carried.filter((path) => path !== FIELD_TO_PATH[field]);

  switch (field) {
    case "d": {
      const preset = DUE_DATE_PRESETS.find((option) => option.value === value);
      if (!preset) return { ok: false, message: FAILED.change };
      const loaded = await getInvoice({ id: invoiceId });
      if (!loaded.ok || !loaded.invoice) {
        return { ok: false, message: FAILED.gone };
      }
      const dueDate = addCalendarDaysYmd(
        loaded.invoice.meta.issueDate,
        preset.days,
      );
      return patchDraft(invoiceId, remaining, { meta: { dueDate } });
    }
    case "c":
      return patchDraft(invoiceId, remaining, { meta: { currency: value } });
    case "l":
      return patchDraft(invoiceId, remaining, { meta: { language: value } });
    case "v": {
      const vat = vatOptionFor(value);
      if (!vat) return { ok: false, message: FAILED.change };
      /** `vat.mode` shares the same field, so clear both flags. */
      return patchDraft(
        invoiceId,
        remaining.filter((path) => path !== "vat.mode"),
        { vat },
      );
    }
    default: {
      const _exhaustive: never = field;
      return { ok: false, message: String(_exhaustive) };
    }
  }
}

/**
 * Runs one card control against the clicker's workspace.
 *
 * Every branch re-reads the invoice afterwards rather than trusting what the
 * card said, so a stale card cannot report a state the database does not have.
 */
export async function runInvoiceCardAction(
  input: InvoiceCardActionInput,
): Promise<InvoiceCardActionResult> {
  const { action, invoiceId, value, actorLabel } = input;
  const assumedPaths = input.assumedPaths ?? [];

  return runWithInvoiceyContext(input.principal, async () => {
    const copy = copyFor(await localeFor(invoiceId));

    switch (action) {
      case "issue": {
        const result = await issueInvoiceById({ id: invoiceId });
        if (!result.ok) {
          return { ok: false, message: `${FAILED.issue} — ${result.error}` };
        }
        return refreshed(
          invoiceId,
          assumedPaths,
          result.alreadyIssued
            ? copy.text.alreadyIssued.replace(/_/gu, "")
            : `${copy.text.issuedBy} ${result.invoice.meta.number}${by(actorLabel, copy.text.by)}.`,
        );
      }

      case "mark_paid": {
        const result = await markInvoicePaidById({ id: invoiceId });
        if (!result.ok) {
          return { ok: false, message: `${FAILED.markPaid} — ${result.error}` };
        }
        return refreshed(
          invoiceId,
          assumedPaths,
          `${copy.text.markedPaidBy}${by(actorLabel, copy.text.by)}.`,
        );
      }

      case "send_email": {
        const result = await sendInvoiceEmailById({ id: invoiceId });
        if (!result.ok) {
          const hint =
            result.error === "missing_recipient"
              ? FAILED.missingRecipient
              : result.error;
          return { ok: false, message: `${FAILED.send} — ${hint}` };
        }
        return refreshed(
          invoiceId,
          assumedPaths,
          `${copy.text.sentTo} ${result.to}${by(actorLabel, copy.text.by)}.`,
        );
      }

      case "discard": {
        const model = await invoiceCardModelFor(invoiceId, assumedPaths);
        const result = await bulkDeleteDraftInvoices({ ids: [invoiceId] });
        if (result.ok !== 1) {
          return { ok: false, message: FAILED.discard };
        }
        return {
          ok: true,
          kind: "discarded",
          invoiceId,
          title: model?.title.split(" · ").pop() ?? copy.state.draft,
        };
      }

      case "change": {
        if (!input.field || !value) {
          return { ok: false, message: FAILED.change };
        }
        return applyChange(invoiceId, assumedPaths, input.field, value);
      }

      default: {
        const _exhaustive: never = action;
        return { ok: false, message: String(_exhaustive) };
      }
    }
  });
}
