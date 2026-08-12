import {
  OutOfAiTokensError,
  assertHasTokens,
  getDefaultWorkspaceId,
  recordLlmUsage,
  tryCreateDbFromEnv,
} from "@invoicey/db";
import { defineHook, type HookContext } from "eve/hooks";

/**
 * Gate Slack/Eve turns when the workspace has no AI tokens, and meter each
 * completed model step against product=slack.
 */
export default defineHook({
  events: {
    async "turn.started"(_event, ctx) {
      const database = tryCreateDbFromEnv();
      if (!database) return;

      const workspaceId = workspaceFromCtx(ctx);
      try {
        await assertHasTokens(database, workspaceId);
      } catch (err) {
        if (err instanceof OutOfAiTokensError) {
          throw new Error(
            "This workspace has no AI tokens remaining. Open Settings → Usage in Invoicey, or wait for the monthly renewal.",
          );
        }
        throw err;
      }
    },

    async "step.completed"(event, ctx) {
      const database = tryCreateDbFromEnv();
      if (!database) return;

      const usage = event.data.usage;
      const promptTokens = usage?.inputTokens ?? 0;
      const completionTokens = usage?.outputTokens ?? 0;
      if (promptTokens + completionTokens <= 0) return;

      const workspaceId = workspaceFromCtx(ctx);
      const userId = userIdFromCtx(ctx);
      const model =
        process.env.INVOICEY_AI_MODEL?.trim() || "openai/gpt-4o-mini";

      try {
        await recordLlmUsage({
          workspaceId,
          userId,
          product: "slack",
          model,
          promptTokens,
          completionTokens,
          metadata: {
            turnId: event.data.turnId,
            stepIndex: event.data.stepIndex,
            finishReason: event.data.finishReason,
            channel: ctx.channel.kind ?? null,
          },
        });
      } catch {
        /** metering must not fail the turn after the model already ran */
      }
    },
  },
});

function workspaceFromCtx(ctx: HookContext): string {
  const attrs = ctx.session.auth.current?.attributes;
  const fromAuth =
    typeof attrs?.workspaceId === "string" ? attrs.workspaceId.trim() : "";
  if (fromAuth) return fromAuth;
  return getDefaultWorkspaceId();
}

function userIdFromCtx(ctx: HookContext): string | undefined {
  const current = ctx.session.auth.current;
  if (!current) return undefined;
  const attrs = current.attributes;
  if (typeof attrs?.userId === "string") return attrs.userId;
  if (current.principalType === "user") return current.principalId;
  return undefined;
}
