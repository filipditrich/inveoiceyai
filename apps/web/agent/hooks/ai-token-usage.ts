import {
  OutOfAiTokensError,
  assertHasTokens,
  getDefaultWorkspaceId,
  recordLlmUsage,
  tryCreateDbFromEnv,
} from "@invoicey/db";
import { defineHook, type HookContext } from "eve/hooks";

import {
  isSlackSession,
  meteringIdentityFromAuth,
} from "../lib/metering-identity";

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
      if (!workspaceId) {
        throw new Error(
          "This Slack account is not linked to Invoicey. Open the DM link to confirm, then try again.",
        );
      }
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

      const identity = meteringIdentityFromAuth(
        ctx.session.auth.current,
        getDefaultWorkspaceId(),
      );
      if (!identity.workspaceId) return;

      const model =
        process.env.INVOICEY_AI_MODEL?.trim() || "openai/gpt-4o-mini";

      try {
        await recordLlmUsage({
          workspaceId: identity.workspaceId,
          userId: identity.userId,
          product: "slack",
          model,
          promptTokens,
          completionTokens,
          metadata: {
            turnId: event.data.turnId,
            stepIndex: event.data.stepIndex,
            finishReason: event.data.finishReason,
            channel: ctx.channel.kind ?? null,
            principalId: identity.principalId ?? null,
            slackTeamId: identity.slackTeamId ?? null,
            slackUserId: identity.slackUserId ?? null,
          },
        });
      } catch (err) {
        console.error("[invoicey-slack] AI token metering failed", err);
      }
    },
  },
});

function workspaceFromCtx(ctx: HookContext): string | null {
  const current = ctx.session.auth.current;
  const identity = meteringIdentityFromAuth(current, getDefaultWorkspaceId());
  if (isSlackSession(current) && !identity.workspaceId) return null;
  return identity.workspaceId || null;
}
