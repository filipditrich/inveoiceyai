import { connectSlackCredentials } from "@vercel/connect/eve";
import { slackChannel } from "eve/channels/slack";

import {
  asInvoiceyState,
  clearPendingCard,
  clearThinkingState,
} from "../lib/slack-channel-extras";
import { SLACK_CONNECT_UID } from "../lib/slack-connect";
import { handleSlackInbound } from "../lib/slack-inbound";
import { handleInvoiceyInteraction } from "../lib/slack-interactions";
import {
  buildInvoiceCard,
  pendingCardFromToolResult,
} from "../lib/slack-invoice-card";
import {
  appendThinkingTasks,
  completeThinkingTask,
  hasActiveThinkingStream,
  startThinkingStream,
  stopThinkingStream,
} from "../lib/slack-thinking-stream";
import { appOrigin } from "../lib/slack-thread";
import {
  invoiceyActionLabel,
  invoiceyActionsLabel,
  actionRequestsPauseReason,
  pauseNotice,
  thinkingTaskId,
  thinkingTaskIdForTool,
  truncateTypingStatus,
} from "../lib/slack-tool-labels";
import { toolOutputSnippet } from "../lib/slack-tool-output";

function firstNonEmptyLine(text: string): string | undefined {
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return undefined;
}

function resolveWebUrl(
  existing: string | null | undefined,
  output: unknown,
): string | null {
  if (typeof existing === "string" && existing.length > 0) return existing;
  if (!output || typeof output !== "object") return null;
  const record = output as Record<string, unknown>;
  if (typeof record.webUrl === "string") return record.webUrl;
  if (typeof record.invoiceId === "string") {
    return `${appOrigin()}/invoices/${record.invoiceId}`;
  }
  if (typeof record.id === "string") {
    return `${appOrigin()}/invoices/${record.id}`;
  }
  const summary = record.summary;
  if (summary && typeof summary === "object") {
    const id = (summary as { id?: unknown }).id;
    if (typeof id === "string") return `${appOrigin()}/invoices/${id}`;
  }
  return null;
}

export default slackChannel({
  credentials: connectSlackCredentials(SLACK_CONNECT_UID),
  threadContext: { since: "last-agent-reply" },
  onAppMention: (ctx, message) =>
    handleSlackInbound(ctx, message, { alwaysHandle: true }),
  onDirectMessage: (ctx, message) =>
    handleSlackInbound(ctx, message, { alwaysHandle: true }),
  onMessage: (ctx, message) =>
    handleSlackInbound(ctx, message, { alwaysHandle: false }),
  onInteraction: handleInvoiceyInteraction,
  events: {
    async "turn.started"(_data, channel) {
      const state = asInvoiceyState(channel.state);
      state.pendingToolCallMessage = null;
      state.pendingPauseReason = null;
      state.lastReasoningTypingAtMs = null;
      state.lastReasoningTypingStatus = null;
      clearPendingCard(state);
      clearThinkingState(state);
      /** stream starts on first tool batch so clarify-only turns stay quiet */
      await channel.thread.startTyping("Working…");
    },

    async "actions.requested"(data, channel) {
      const state = asInvoiceyState(channel.state);
      const pending = state.pendingToolCallMessage;
      state.pendingToolCallMessage = null;

      const tasks = [];
      const seenTaskIds = new Set<string>();
      for (const action of data.actions) {
        const id = thinkingTaskId(action);
        if (seenTaskIds.has(id)) continue;
        seenTaskIds.add(id);
        tasks.push({
          id,
          title: invoiceyActionLabel(action),
          status: "in_progress" as const,
        });
      }

      let streaming = hasActiveThinkingStream(channel);
      if (!streaming) {
        streaming = await startThinkingStream(channel);
      }

      if (streaming) {
        await appendThinkingTasks(channel, tasks);
        const pause = actionRequestsPauseReason(data.actions);
        if (pause) {
          state.pendingPauseReason = pause;
          await stopThinkingStream(channel, {
            markdown: pauseNotice(pause),
          });
        }
        return;
      }

      if (pending) {
        await channel.thread.startTyping(truncateTypingStatus(pending));
        return;
      }
      await channel.thread.startTyping(invoiceyActionsLabel(data.actions));
    },

    async "action.result"(data, channel) {
      const result = data.result;
      if (result.kind !== "tool-result") return;

      const output = result.output;
      const pending = pendingCardFromToolResult(result.toolName, output);
      if (pending) {
        pending.webUrl = resolveWebUrl(pending.webUrl, output);
        asInvoiceyState(channel.state).pendingInvoiceCard = pending;
      }

      if (!hasActiveThinkingStream(channel)) return;

      const isError =
        data.status === "failed" ||
        data.status === "rejected" ||
        result.isError === true ||
        (output !== null &&
          typeof output === "object" &&
          (output as { ok?: unknown }).ok === false);

      await completeThinkingTask(channel, {
        id: thinkingTaskIdForTool(result.toolName, result.callId),
        status: isError ? "error" : "complete",
        output: toolOutputSnippet(result.toolName, output),
      });
    },

    async "message.completed"(data, channel) {
      if (data.finishReason === "tool-calls") {
        asInvoiceyState(channel.state).pendingToolCallMessage = data.message
          ? (firstNonEmptyLine(data.message) ?? null)
          : null;
        return;
      }

      const state = asInvoiceyState(channel.state);
      const pendingCard = state.pendingInvoiceCard ?? null;
      clearPendingCard(state);

      if (hasActiveThinkingStream(channel)) {
        const stopped = await stopThinkingStream(channel, {
          markdown: pendingCard ? null : data.message,
          card: pendingCard,
        });
        if (stopped) {
          await channel.thread.startTyping();
          return;
        }
      }

      if (pendingCard) {
        await channel.thread.post({
          card: buildInvoiceCard(pendingCard),
          fallbackText: pendingCard.fallbackText,
        });
        await channel.thread.startTyping();
        return;
      }

      if (!data.message) {
        await channel.thread.startTyping();
        return;
      }
      await channel.thread.post(data.message);
    },

    async "turn.failed"(data, channel) {
      clearPendingCard(asInvoiceyState(channel.state));
      const detail =
        typeof data.message === "string" && data.message.length > 0
          ? ` (${data.message})`
          : "";
      const text = [
        `I hit an error while handling your request${detail}.`,
        "",
        "Please try again, rephrase, or reach out if it keeps failing.",
      ].join("\n");

      if (hasActiveThinkingStream(channel)) {
        await stopThinkingStream(channel, { markdown: text });
        await channel.thread.startTyping();
        return;
      }

      clearThinkingState(asInvoiceyState(channel.state));
      await channel.thread.post(text);
    },

    async "turn.completed"(_data, channel) {
      if (hasActiveThinkingStream(channel)) {
        await stopThinkingStream(channel);
      }
      await channel.thread.startTyping();
    },

    async "turn.cancelled"(_data, channel) {
      if (hasActiveThinkingStream(channel)) {
        await stopThinkingStream(channel, { markdown: "_Cancelled._" });
      }
      clearPendingCard(asInvoiceyState(channel.state));
      await channel.thread.startTyping();
    },

    async "session.waiting"(_data, channel) {
      if (hasActiveThinkingStream(channel)) {
        const state = asInvoiceyState(channel.state);
        await stopThinkingStream(channel, {
          markdown: pauseNotice(state.pendingPauseReason ?? "approval"),
        });
      }
    },
  },
});
