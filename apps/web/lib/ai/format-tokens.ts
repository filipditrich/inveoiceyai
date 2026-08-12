/** Compact token count for UI (e.g. 1.5M, 500k). */
export function formatTokenCount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(Math.floor(n));
  if (abs >= 1_000_000) {
    const v = abs / 1_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const v = abs / 1_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}k`;
  }
  return String(abs);
}
