import { describeActionRequest } from "eve/channels/slack";

type ActionRequest = Parameters<typeof describeActionRequest>[0];

const SLACK_TYPING_STATUS_MAX_LENGTH = 50;

/** Tools gated by Eve `approval: always()` — park for Slack Allow/Deny. */
export const HITL_TOOL_NAMES = new Set([
  "issue_invoice",
  "mark_invoice_paid",
  "send_invoice_email",
]);

const TOOL_LABELS: Record<string, string> = {
  search_business: "Searching ARES…",
  lookup_business: "Looking up company in ARES…",
  list_presets: "Loading presets…",
  get_preset: "Loading preset…",
  save_preset: "Saving preset…",
  create_invoice: "Creating invoice draft…",
  upload_invoice_files: "Uploading PDF and ISDOC…",
  list_invoices: "Listing invoices…",
  get_invoice: "Loading invoice…",
  issue_invoice: "Issuing invoice…",
  mark_invoice_paid: "Marking invoice paid…",
  send_invoice_email: "Sending invoice email…",
};

/** Human-readable typing / task title for one Eve action request. */
export function invoiceyActionLabel(action: ActionRequest): string {
  switch (action.kind) {
    case "tool-call":
      return TOOL_LABELS[action.toolName] ?? action.toolName;
    case "load-skill":
      return "Loading skill…";
    case "subagent-call":
      return action.subagentName;
    case "remote-agent-call":
      return action.remoteAgentName;
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

/** Slack `assistant.threads.setStatus` is plain text, max 50 chars. */
export function truncateTypingStatus(text: string): string {
  const compact = text.trim().replace(/\s+/gu, " ");
  if (compact.length <= SLACK_TYPING_STATUS_MAX_LENGTH) return compact;
  return `${compact.slice(0, SLACK_TYPING_STATUS_MAX_LENGTH - 3).trimEnd()}...`;
}

/** True when this batch will pause for Slack Allow/Deny. */
export function actionRequestsNeedApproval(
  actions: readonly ActionRequest[],
): boolean {
  return actions.some(
    (action) =>
      action.kind === "tool-call" && HITL_TOOL_NAMES.has(action.toolName),
  );
}

/** Typing indicator for a batch of requested actions. */
export function invoiceyActionsLabel(
  actions: readonly ActionRequest[],
): string {
  const [first] = actions;
  if (first === undefined) return "Working…";
  const label = invoiceyActionLabel(first);
  if (actions.length === 1) return truncateTypingStatus(label);
  return truncateTypingStatus(`${label} +${actions.length - 1} more`);
}

/** Stable task id for Thinking Steps task_update chunks. */
export function thinkingTaskId(action: ActionRequest): string {
  return action.callId;
}
