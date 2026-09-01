import { isSlackLinkCodeOpen, type SlackLinkCodeRecord } from "@invoicey/db";

export type SlackLinkViewState =
  | "not_found"
  | "expired"
  | "consumed"
  | "pending";

export function resolveSlackLinkViewState(
  row: SlackLinkCodeRecord | null,
  now = new Date(),
): SlackLinkViewState {
  if (!row) return "not_found";
  if (row.consumedAt != null) return "consumed";
  if (!isSlackLinkCodeOpen(row, now)) return "expired";
  return "pending";
}
