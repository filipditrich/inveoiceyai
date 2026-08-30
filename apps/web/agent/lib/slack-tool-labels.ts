import { describeActionRequest } from "eve/channels/slack";

import {
  ASK_QUESTION_TOOL,
  HITL_TOOL_NAMES,
  TOOL_LABELS,
  toolLabel,
} from "./tool-presentation";

export { ASK_QUESTION_TOOL, HITL_TOOL_NAMES, TOOL_LABELS };

type ActionRequest = Parameters<typeof describeActionRequest>[0];

const SLACK_TYPING_STATUS_MAX_LENGTH = 50;

/** Tools whose retries share one Thinking Steps row (last result wins). */
const COLLAPSE_TOOL_TASKS = new Set([
  "create_invoice",
  "update_invoice_draft",
  "upload_invoice_files",
]);

/** Human-readable typing / task title for one Eve action request. */
export function invoiceyActionLabel(action: ActionRequest): string {
  switch (action.kind) {
    case "tool-call":
      return toolLabel(action.toolName);
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

/** Why this batch is about to park, so the thread can say the right thing. */
export type PauseReason = "approval" | "question";

export function actionRequestsPauseReason(
  actions: readonly ActionRequest[],
): PauseReason | null {
  if (actionRequestsNeedApproval(actions)) return "approval";
  const asks = actions.some(
    (action) =>
      action.kind === "tool-call" && action.toolName === ASK_QUESTION_TOOL,
  );
  return asks ? "question" : null;
}

const PAUSE_NOTICES: Record<PauseReason, string> = {
  approval: "Waiting for approval…",
  question: "Waiting for your answer…",
};

export function pauseNotice(reason: PauseReason): string {
  return PAUSE_NOTICES[reason];
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
export function thinkingTaskIdForTool(
  toolName: string,
  callId: string,
): string {
  if (COLLAPSE_TOOL_TASKS.has(toolName)) return `tool:${toolName}`;
  return callId;
}

export function thinkingTaskId(action: ActionRequest): string {
  if (action.kind === "tool-call") {
    return thinkingTaskIdForTool(action.toolName, action.callId);
  }
  return action.callId;
}
