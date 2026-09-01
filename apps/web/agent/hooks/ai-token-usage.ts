import { defineHook, type HookContext } from "eve/hooks";

import {
  OutOfAiTokensError,
  assertHasTokens,
  getDefaultWorkspaceId,
  recordLlmUsage,
  tryCreateDbFromEnv,
} from "@invoicey/db";

import {
  isSlackSession,
  meteringIdentityFromAuth,
} from "../lib/metering-identity";
import { resolveSlackToolPrincipal } from "../lib/slack-identity";
import { isWebSession } from "../lib/web-identity";

/**
 * Gate Slack/Eve turns when the workspace has no AI tokens, and meter each
 * completed model step.
 *
 * One agent serves both surfaces, so the product is read off the session's own
 * principal rather than assumed: the in-app assistant meters as `web`, Slack
 * and the ops bearer as `slack`. Settings → Usage splits on that field.
 */
export default defineHook({
  events: {
    async "turn.started"(_event, ctx) {
      const database = tryCreateDbFromEnv();
      if (!database) return;

      const workspaceId = await workspaceFromCtx(ctx);
      /** unlinked Slack has no workspace; throwing here becomes Eve FatalError after retries */
      if (!workspaceId) return;
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

      const identity = await meteringIdentityFromCtx(ctx);
      if (!identity.workspaceId) return;

      const model =
        process.env.INVOICEY_AI_MODEL?.trim() || "anthropic/claude-haiku-4.5";
      const product = isWebSession(ctx.session.auth.current) ? "web" : "slack";

      try {
        await recordLlmUsage({
          workspaceId: identity.workspaceId,
          userId: identity.userId,
          product,
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
        if (err instanceof OutOfAiTokensError) {
          /** remaining was debited; next turn is gated */
          return;
        }
        console.error("[invoicey-agent] AI token metering failed", err);
      }
    },
  },
});

async function meteringIdentityFromCtx(ctx: HookContext) {
  const current = ctx.session.auth.current;
  const initiator = ctx.session.auth.initiator;
  const identity = meteringIdentityFromAuth(current, getDefaultWorkspaceId());
  if (!isSlackSession(current) && !isSlackSession(initiator)) {
    return identity;
  }
  const principal = await resolveSlackToolPrincipal({ current, initiator });
  if (principal.status !== "linked") {
    return { ...identity, workspaceId: "", userId: undefined };
  }
  return {
    ...identity,
    workspaceId: principal.identity.workspaceId,
    userId: principal.identity.userId,
  };
}

async function workspaceFromCtx(ctx: HookContext): Promise<string | null> {
  const identity = await meteringIdentityFromCtx(ctx);
  if (isSlackSession(ctx.session.auth.current) && !identity.workspaceId) {
    return null;
  }
  return identity.workspaceId || null;
}
