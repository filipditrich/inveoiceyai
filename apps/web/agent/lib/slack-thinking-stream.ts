import { cardToBlocks } from "eve/channels/slack";

import {
  asInvoiceyState,
  clearThinkingState,
  type InvoiceySlackState,
  type PendingInvoiceCard,
} from "./slack-channel-extras";
import { buildInvoiceCard } from "./slack-invoice-card";
import type { SlackEventContext } from "eve/channels/slack";

type TaskStatus = "pending" | "in_progress" | "complete" | "error";

interface TaskUpdateChunk {
  type: "task_update";
  id: string;
  title: string;
  status: TaskStatus;
  details?: string;
  output?: string;
  sources?: Array<{ type: "url"; text: string; url: string }>;
}

type StreamChunk =
  | TaskUpdateChunk
  | { type: "markdown_text"; text: string }
  | { type: "blocks"; blocks: unknown[] };

function streamTs(state: InvoiceySlackState): string | null {
  return state.thinkingActive === true &&
    typeof state.thinkingStreamTs === "string"
    ? state.thinkingStreamTs
    : null;
}

function logStreamFailure(operation: string, detail: unknown): void {
  const message =
    detail && typeof detail === "object" && "error" in detail
      ? String((detail as { error: unknown }).error)
      : detail instanceof Error
        ? detail.message
        : String(detail);
  console.warn(`[invoicey-slack] ${operation} failed: ${message}`);
}

async function appendChunks(
  channel: SlackEventContext,
  chunks: StreamChunk[],
): Promise<boolean> {
  const state = asInvoiceyState(channel.state);
  const ts = streamTs(state);
  if (!ts || !channel.state.channelId) return false;
  try {
    const res = await channel.slack.request("chat.appendStream", {
      channel: channel.state.channelId,
      ts,
      chunks,
    });
    if (res.ok !== true) {
      logStreamFailure("chat.appendStream", res);
      return false;
    }
    return true;
  } catch (error) {
    logStreamFailure("chat.appendStream", error);
    return false;
  }
}

/** Open a Thinking Steps stream for this turn; falls back to typing on failure. */
export async function startThinkingStream(
  channel: SlackEventContext,
): Promise<boolean> {
  const state = asInvoiceyState(channel.state);
  clearThinkingState(state);

  const channelId = channel.state.channelId;
  const threadTs = channel.state.threadTs;
  const userId = channel.state.triggeringUserId;
  if (!channelId || !threadTs || !userId) return false;

  const body: Record<string, unknown> = {
    channel: channelId,
    thread_ts: threadTs,
    task_display_mode: "timeline",
    recipient_user_id: userId,
  };
  if (channel.state.teamId) {
    body.recipient_team_id = channel.state.teamId;
  }

  try {
    const res = await channel.slack.request("chat.startStream", body);
    const ts = typeof res.ts === "string" ? res.ts : null;
    if (res.ok !== true || !ts) {
      logStreamFailure("chat.startStream", res);
      return false;
    }
    state.thinkingStreamTs = ts;
    state.thinkingActive = true;
    state.thinkingOpenTasks = {};
    return true;
  } catch (error) {
    logStreamFailure("chat.startStream", error);
    return false;
  }
}

export async function appendThinkingTasks(
  channel: SlackEventContext,
  tasks: Array<{ id: string; title: string; status?: TaskStatus }>,
): Promise<void> {
  if (tasks.length === 0) return;
  const state = asInvoiceyState(channel.state);
  if (!streamTs(state)) return;
  state.thinkingOpenTasks ??= {};
  const chunks: TaskUpdateChunk[] = tasks.map((task) => {
    const status = task.status ?? "in_progress";
    if (status === "in_progress" || status === "pending") {
      state.thinkingOpenTasks![task.id] = task.title;
    }
    return {
      type: "task_update",
      id: task.id,
      title: task.title,
      status,
    };
  });
  await appendChunks(channel, chunks);
}

export async function completeThinkingTask(
  channel: SlackEventContext,
  input: {
    id: string;
    title?: string;
    status?: "complete" | "error";
    output?: string;
  },
): Promise<void> {
  const state = asInvoiceyState(channel.state);
  if (!streamTs(state)) return;
  const title = input.title ?? state.thinkingOpenTasks?.[input.id] ?? "Done";
  if (state.thinkingOpenTasks) {
    delete state.thinkingOpenTasks[input.id];
  }
  const chunk: TaskUpdateChunk = {
    type: "task_update",
    id: input.id,
    title,
    status: input.status ?? "complete",
  };
  if (input.output) chunk.output = input.output;
  await appendChunks(channel, [chunk]);
}

/** Finalize the stream with a card, or markdown when there is no card. */
export async function stopThinkingStream(
  channel: SlackEventContext,
  input?: {
    markdown?: string | null;
    card?: PendingInvoiceCard | null;
  },
): Promise<boolean> {
  const state = asInvoiceyState(channel.state);
  const ts = streamTs(state);
  const channelId = channel.state.channelId;
  if (!ts || !channelId) {
    clearThinkingState(state);
    return false;
  }

  const chunks: StreamChunk[] = [];
  if (input?.card) {
    const card = buildInvoiceCard(input.card);
    chunks.push({ type: "blocks", blocks: cardToBlocks(card) });
  } else if (input?.markdown && input.markdown.trim().length > 0) {
    chunks.push({ type: "markdown_text", text: input.markdown });
  }

  try {
    const res = await channel.slack.request("chat.stopStream", {
      channel: channelId,
      ts,
      chunks: chunks.length > 0 ? chunks : undefined,
    });
    if (res.ok !== true) {
      logStreamFailure("chat.stopStream", res);
      clearThinkingState(state);
      return false;
    }
    clearThinkingState(state);
    return true;
  } catch (error) {
    logStreamFailure("chat.stopStream", error);
    clearThinkingState(state);
    return false;
  }
}

export function hasActiveThinkingStream(channel: SlackEventContext): boolean {
  return streamTs(asInvoiceyState(channel.state)) !== null;
}
