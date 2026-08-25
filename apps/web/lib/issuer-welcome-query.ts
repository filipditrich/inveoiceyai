const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Returns only a UUID candidate that is safe to use in a workspace query. */
export function welcomeDoneIssuerId(value: string | undefined): string | null {
  return value && UUID_PATTERN.test(value) ? value : null;
}
