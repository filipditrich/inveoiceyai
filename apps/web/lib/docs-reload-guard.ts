/** client-side burst detector for a docs tab stuck in a reload loop */

export const DOCS_RELOAD_WINDOW_MS = 15_000;
export const DOCS_RELOAD_MAX_LOADS = 10;
export const DOCS_RELOAD_STORAGE_KEY = "invoicey-docs-loads";
export const DOCS_RELOAD_BLOCKED_KEY = "invoicey-docs-loop";

export type DocsLoadRecord = {
  timestamps: number[];
  tripped: boolean;
};

export function recordDocsLoads(
  previous: readonly number[],
  now: number,
): DocsLoadRecord {
  const timestamps = previous.filter(
    (stamp) => now - stamp < DOCS_RELOAD_WINDOW_MS,
  );
  timestamps.push(now);
  return {
    timestamps,
    tripped: timestamps.length >= DOCS_RELOAD_MAX_LOADS,
  };
}

export function parseDocsLoadStamps(raw: string | null): number[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((stamp): stamp is number => Number.isFinite(stamp));
  } catch {
    return [];
  }
}
