/**
 * Outcomes where a sweep declined to call the bank at all.
 *
 * A provider rate limit means "ask again shortly", not "this connection is
 * broken". Counting one as a failure would burn the alert streak, push
 * `next_sync_at` out by the failure backoff, and e-mail the workspace about a
 * connection that is perfectly healthy — so skips are bookkept separately from
 * failures everywhere.
 */
const BANK_SYNC_SKIP_CODES = new Set([
  /** Another run already holds the lease. */
  "sync_busy",
  /** Local interval guard fired before we spent a provider request. */
  "fio_throttled_locally",
  "moneta_throttled_locally",
  /** Provider answered 409 / 429: too soon. */
  "fio_throttled",
  "moneta_throttled",
]);

export function isBankSyncSkip(code: string | undefined | null): boolean {
  return code !== undefined && code !== null && BANK_SYNC_SKIP_CODES.has(code);
}
