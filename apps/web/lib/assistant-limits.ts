/**
 * Session input budget shown in the panel and enforced by Eve.
 * Keep in lockstep with `limits.maxInputTokensPerSession` in `agent/agent.ts`.
 */
export const ASSISTANT_CONTEXT_LIMIT_TOKENS = 64_000;

/** Soft warning before Eve parks the session for a budget approval. */
export const ASSISTANT_CONTEXT_WARN_RATIO = 0.85;
