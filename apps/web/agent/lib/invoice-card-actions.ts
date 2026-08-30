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
  buildInvoiceCardModel,
  cardStateFromSummary,
  type InvoiceCardModel,
} from "./invoice-card-model";
import { DUE_DATE_PRESETS } from "./slack-invoice-actions";
import { appOrigin } from "./slack-thread";

/**
 * What a review-card control does, with no surface in it.
 *
 * The Slack thread and the in-app assistant panel show the same card, so a
 * click has to mean the same thing on both. Keeping the effect here — one
 * function, resolved against the clicker's own workspace — is what makes that
 * true by construction instead of by two handlers agreeing for a while.
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
  "set_due",
  "set_currency",
  "set_vat",
  "set_language",
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
  /** Select-menu payload: due-date preset, currency, `mode|suppliesAbroad`, language. */
  value?: string | null;
  principal: { workspaceId: string; userId: string };
  /** Names the actor in the note ("Issued by …"), already surface-formatted. */
  actorLabel?: string;
}

function webUrlFor(invoiceId: string): string {
  return `${appOrigin()}/invoices/${invoiceId}`;
}

/** Re-reads the invoice and rebuilds its card from the persisted truth. */
export async function invoiceCardModelFor(
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

async function refreshed(
  invoiceId: string,
  note?: string,
): Promise<InvoiceCardActionResult> {
  const card = await invoiceCardModelFor(invoiceId);
  if (!card) {
    return { ok: false, message: "That invoice is no longer available." };
  }
  return { ok: true, kind: "card", card, note };
}

function by(actorLabel: string | undefined): string {
  return actorLabel ? ` by ${actorLabel}` : "";
}

async function patchDraft(
  invoiceId: string,
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
    return { ok: false, message: `Could not apply that change — ${reason}` };
  }
  return refreshed(invoiceId);
}

async function setDue(
  invoiceId: string,
  value: string,
): Promise<InvoiceCardActionResult> {
  const preset = DUE_DATE_PRESETS.find((option) => option.value === value);
  if (!preset) {
    return { ok: false, message: `Unknown due-date option "${value}".` };
  }
  const loaded = await getInvoice({ id: invoiceId });
  if (!loaded.ok || !loaded.invoice) {
    return { ok: false, message: "That invoice is no longer available." };
  }
  const dueDate = addCalendarDaysYmd(
    loaded.invoice.meta.issueDate,
    preset.days,
  );
  return patchDraft(invoiceId, { meta: { dueDate } });
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

  return runWithInvoiceyContext(input.principal, async () => {
    switch (action) {
      case "issue": {
        const result = await issueInvoiceById({ id: invoiceId });
        if (!result.ok) {
          return { ok: false, message: `Could not issue — ${result.error}` };
        }
        return refreshed(
          invoiceId,
          result.alreadyIssued
            ? "Already issued."
            : `Issued as ${result.invoice.meta.number}${by(actorLabel)}.`,
        );
      }

      case "mark_paid": {
        const result = await markInvoicePaidById({ id: invoiceId });
        if (!result.ok) {
          return {
            ok: false,
            message: `Could not mark paid — ${result.error}`,
          };
        }
        return refreshed(invoiceId, `Marked paid${by(actorLabel)}.`);
      }

      case "send_email": {
        const result = await sendInvoiceEmailById({ id: invoiceId });
        if (!result.ok) {
          const hint =
            result.error === "missing_recipient"
              ? "the client has no e-mail address on file — say “send it to name@example.com” instead"
              : result.error;
          return { ok: false, message: `Could not send — ${hint}` };
        }
        return refreshed(invoiceId, `Sent to ${result.to}${by(actorLabel)}.`);
      }

      case "discard": {
        const model = await invoiceCardModelFor(invoiceId);
        const result = await bulkDeleteDraftInvoices({ ids: [invoiceId] });
        if (result.ok !== 1) {
          return {
            ok: false,
            message: "Could not discard that draft — it may already be issued.",
          };
        }
        return {
          ok: true,
          kind: "discarded",
          invoiceId,
          title: model?.title.split(" · ").pop() ?? "Draft",
        };
      }

      case "set_due": {
        if (!value) return { ok: false, message: "Missing due-date option." };
        return setDue(invoiceId, value);
      }

      /**
       * The select values are not re-checked against the card's option lists:
       * `updateDraftInvoice` validates the patch and returns a real reason
       * (`oss requires abroad`), which is more useful to the clicker than this
       * layer saying the option is unknown.
       */
      case "set_currency": {
        if (!value) return { ok: false, message: "Missing currency." };
        return patchDraft(invoiceId, { meta: { currency: value } });
      }

      case "set_language": {
        if (!value) return { ok: false, message: "Missing language." };
        return patchDraft(invoiceId, { meta: { language: value } });
      }

      case "set_vat": {
        if (!value) return { ok: false, message: "Missing VAT treatment." };
        const [mode, suppliesAbroad] = value.split("|");
        if (!mode || !suppliesAbroad) {
          return { ok: false, message: `Unknown VAT treatment "${value}".` };
        }
        return patchDraft(invoiceId, { vat: { mode, suppliesAbroad } });
      }

      default: {
        const _exhaustive: never = action;
        return {
          ok: false,
          message: `Unknown action "${String(_exhaustive)}".`,
        };
      }
    }
  });
}
