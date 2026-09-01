/** Invoice id (UUID) or issued number as typed in the CLI. */
export function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

/** Strip wildcards so an ilike search cannot match everything. */
export function sanitizeSearch(value: string): string {
  return value
    .trim()
    .replace(/[%_\\]/g, "")
    .slice(0, 80);
}
