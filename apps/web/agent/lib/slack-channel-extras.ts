import type { InvoiceCardModel } from "./invoice-card-model";
import type { SlackChannelState } from "eve/channels/slack";

/** Serializable card snapshot built from tool results for Slack finals. */
export interface PendingInvoiceCard {
  kind: "invoice" | "list";
  title: string;
  subtitle?: string;
  fields: Array<{ label: string; value: string }>;
  webUrl?: string | null;
  fallbackText: string;
  /**
   * Full card model when the tool produced one. Present for invoice cards
   * that carry interactive controls; absent for the flat legacy snapshots
   * (lists, email receipts) that only ever render fields.
   */
  model?: InvoiceCardModel;
}

/**
 * Extra per-session Slack fields Invoicey stores on Eve channel state.
 * Eve persists state as JSON; unknown keys round-trip if we write them.
 */
export interface InvoiceySlackExtras {
  thinkingStreamTs?: string | null;
  thinkingActive?: boolean;
  /** open task ids → title (for complete-on-result) */
  thinkingOpenTasks?: Record<string, string>;
  pendingInvoiceCard?: PendingInvoiceCard | null;
  /**
   * Why the turn is parked, set when the pause is requested. `session.waiting`
   * fires without the originating actions, so without this the safety-net
   * notice would call a question an approval.
   */
  pendingPauseReason?: "approval" | "question" | null;
}

export type InvoiceySlackState = SlackChannelState & InvoiceySlackExtras;

export function asInvoiceyState(state: SlackChannelState): InvoiceySlackState {
  return state as InvoiceySlackState;
}

export function clearThinkingState(state: InvoiceySlackState): void {
  state.thinkingStreamTs = null;
  state.thinkingActive = false;
  state.thinkingOpenTasks = {};
}

export function clearPendingCard(state: InvoiceySlackState): void {
  state.pendingInvoiceCard = null;
}
