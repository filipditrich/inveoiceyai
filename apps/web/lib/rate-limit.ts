/**
 * Process-local burst limiter (ADR 0048, "Shared IPs (CGNAT)").
 *
 * This is per-instance state: it is a coarse cap on render cost, never an
 * identity. Two guests behind the same CGNAT share a key; two instances of
 * the app do not. Do not treat a trip as proof that one person is abusing.
 */

export type ConsumeResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export function createFixedWindowLimiter(options: {
  windowMs: number;
  max: number;
  maxKeys?: number;
}): { consume: (key: string, now?: number) => ConsumeResult } {
  const windows = new Map<string, { count: number; resetAt: number }>();
  const maxKeys = options.maxKeys ?? 10_000;

  function evict(now: number) {
    if (windows.size < maxKeys) return;
    for (const [storedKey, window] of windows) {
      if (window.resetAt <= now) windows.delete(storedKey);
    }
    if (windows.size < maxKeys) return;
    const oldestKey = windows.keys().next().value;
    if (oldestKey) windows.delete(oldestKey);
  }

  return {
    consume(key: string, now = Date.now()): ConsumeResult {
      evict(now);
      const current = windows.get(key);
      if (!current || current.resetAt <= now) {
        windows.set(key, { count: 1, resetAt: now + options.windowMs });
        return { ok: true };
      }
      if (current.count >= options.max) {
        return {
          ok: false,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((current.resetAt - now) / 1_000),
          ),
        };
      }
      current.count += 1;
      return { ok: true };
    },
  };
}

export function createConcurrencyGate(max: number): {
  tryEnter: () => boolean;
  leave: () => void;
} {
  let current = 0;
  return {
    tryEnter() {
      if (current >= max) return false;
      current += 1;
      return true;
    },
    leave() {
      current = Math.max(0, current - 1);
    },
  };
}

/** First forwarded hop, else "unknown" — a burst key, not a person. */
export function clientIpKey(request: Request): string {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",", 1)[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ||
    "unknown"
  );
}
