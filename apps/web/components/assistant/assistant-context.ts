import { ASSISTANT_CONTEXT_LIMIT_TOKENS } from "@/lib/assistant-limits";

export { ASSISTANT_CONTEXT_LIMIT_TOKENS };

/**
 * Session input spent so far.
 *
 * Eve's `maxInputTokensPerSession` is a running sum of every model call's
 * input, not the latest window fill. Showing only the last `step.completed`
 * made the bar sit at ~14k while Eve parked the turn at the session cap.
 */
export function contextTokensFromEvents(
  events: readonly { type?: string; data?: unknown }[],
): number {
  let total = 0;
  for (const event of events) {
    const fromStep = inputTokensFromStep(event);
    if (fromStep != null) total += fromStep;
  }
  return total;
}

function inputTokensFromStep(event: {
  type?: string;
  data?: unknown;
}): number | null {
  if (event.type !== "step.completed") return null;
  const usage = readRecord(event.data)?.usage;
  const record = readRecord(usage);
  if (!record) return null;
  return firstNumber(record.inputTokens, record.promptTokens);
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return Math.floor(value);
    }
  }
  return null;
}
