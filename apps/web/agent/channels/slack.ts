import { connectSlackCredentials } from "@vercel/connect/eve";
import { defaultSlackAuth, slackChannel } from "eve/channels/slack";

import {
  asInvoiceyState,
  clearPendingCard,
  clearThinkingState,
} from "../lib/slack-channel-extras";
import { SLACK_CONNECT_UID } from "../lib/slack-connect";
import {
  buildInvoiceCard,
  pendingCardFromToolResult,
} from "../lib/slack-invoice-card";
import { appOrigin } from "../lib/slack-thread";
import {
  appendThinkingTasks,
  completeThinkingTask,
  hasActiveThinkingStream,
  startThinkingStream,
  stopThinkingStream,
} from "../lib/slack-thinking-stream";
import {
  invoiceyActionLabel,
  invoiceyActionsLabel,
  actionRequestsNeedApproval,
  thinkingTaskId,
  truncateTypingStatus,
} from "../lib/slack-tool-labels";

function firstNonEmptyLine(text: string): string | undefined {
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return undefined;
}

function toolOutputSnippet(output: unknown): string | undefined {
  if (!output || typeof output !== "object") return undefined;
  const record = output as Record<string, unknown>;
  if (record.ok === false && typeof record.error === "string") {
    return record.error.slice(0, 200);
  }
  if (typeof record.number === "string") return record.number;
  if (typeof record.clientName === "string") return record.clientName;
  if (Array.isArray(record.invoices)) {
    return `${record.invoices.length} invoice(s)`;
  }
  if (record.ok === true) return "ok";
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
  async onMessage(ctx, message) {
    if (message.author?.isBot) return null;
    const isDirectMessage = message.raw.channel_type === "im";
    const shouldHandle =
      isDirectMessage ||
      ctx.isBotMentioned() ||
      (await ctx.isSubscribed());
    if (!shouldHandle) return null;
    await ctx.cancel();
    const auth = defaultSlackAuth(message, ctx);
    return auth ? { auth } : null;
  },
  events: {
    async "turn.started"(_data, channel) {
      const state = asInvoiceyState(channel.state);
      state.pendingToolCallMessage = null;
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

      const tasks = data.actions.map((action) => ({
        id: thinkingTaskId(action),
        title: invoiceyActionLabel(action),
        status: "in_progress" as const,
      }));

      let streaming = hasActiveThinkingStream(channel);
      if (!streaming) {
        streaming = await startThinkingStream(channel);
      }

      if (streaming) {
        await appendThinkingTasks(channel, tasks);
        if (actionRequestsNeedApproval(data.actions)) {
          await stopThinkingStream(channel, {
            markdown: "Waiting for approval…",
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
        id: result.callId,
        status: isError ? "error" : "complete",
        output: toolOutputSnippet(output),
        webUrl: pending?.webUrl,
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
          markdown: data.message,
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
        if (data.message && data.message.trim().length > 0) {
          /** keep short model narration when it adds context beyond the card */
          const cardHints = [
            pendingCard.title,
            pendingCard.webUrl,
            ...pendingCard.fields.map((f) => f.value),
          ].filter((v): v is string => typeof v === "string" && v.length > 0);
          const addsContext = !cardHints.some((hint) =>
            data.message!.includes(hint),
          );
          if (addsContext && data.message.length < 500) {
            await channel.thread.post(data.message);
          }
        }
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
        await stopThinkingStream(channel, {
          markdown: "Waiting for approval…",
        });
      }
    },
  },
});
