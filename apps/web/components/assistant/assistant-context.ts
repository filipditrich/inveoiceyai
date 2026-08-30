import { ASSISTANT_CONTEXT_LIMIT_TOKENS } from "@/lib/assistant-limits";

export { ASSISTANT_CONTEXT_LIMIT_TOKENS };

/**
 * Latest provider-reported input size on the stream.
 *
 * Eve reports usage on `step.completed` and the compaction trigger. The last
 * input count is the current window fill — not a sum of every step.
 */
export function contextTokensFromEvents(
  events: readonly { type?: string; data?: unknown }[],
): number {
  let latest = 0;
  for (const event of events) {
    const fromStep = inputTokensFromStep(event);
    if (fromStep != null) latest = fromStep;
    const fromCompact = inputTokensFromCompaction(event);
    if (fromCompact != null) latest = fromCompact;
  }
  return latest;
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

function inputTokensFromCompaction(event: {
  type?: string;
  data?: unknown;
}): number | null {
  if (event.type !== "compaction.requested") return null;
  const record = readRecord(event.data);
  if (!record) return null;
  return firstNumber(record.usageInputTokens);
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
