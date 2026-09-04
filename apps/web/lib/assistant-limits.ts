/**
 * Session input budget shown in the panel and enforced by Eve.
 * Keep in lockstep with `limits.maxInputTokensPerSession` in `agent/agent.ts`.
 *
 * This is a running sum of every model call's input, not the latest window
 * fill. 64k tripped after a handful of short turns (~14k each); 256k is still
 * a defective-session guardrail without parking a normal chat.
 */
export const ASSISTANT_CONTEXT_LIMIT_TOKENS = 256_000;

/** Soft warning before Eve parks the session for a budget approval. */
export const ASSISTANT_CONTEXT_WARN_RATIO = 0.85;
