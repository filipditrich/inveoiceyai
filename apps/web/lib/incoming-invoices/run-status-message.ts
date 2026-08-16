const RUN_STATUSES = [
  "draft",
  "ready",
  "submitting",
  "submitted",
  "failed",
  "cancelled",
  "closed",
] as const;

export type RunStatusMessageKey = `runStatus.${(typeof RUN_STATUSES)[number]}`;

export function runStatusMessageKey(status: string): RunStatusMessageKey {
  return (
    RUN_STATUSES.includes(status as (typeof RUN_STATUSES)[number])
      ? `runStatus.${status}`
      : "runStatus.draft"
  ) as RunStatusMessageKey;
}
