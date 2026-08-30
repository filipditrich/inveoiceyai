import { defineAgent } from "eve";

/**
 * Session input budget. Keep in lockstep with
 * `ASSISTANT_CONTEXT_LIMIT_TOKENS` in `lib/assistant-limits.ts` — Eve
 * compiles this file on its own and cannot import the Next app lib.
 */
export default defineAgent({
  model: process.env.INVOICEY_AI_MODEL ?? "anthropic/claude-haiku-4.5",
  compaction: { thresholdPercent: 0.75 },
  limits: {
    maxInputTokensPerSession: 64_000,
  },
});
