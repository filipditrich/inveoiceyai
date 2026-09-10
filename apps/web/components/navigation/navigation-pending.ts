export const NAVIGATION_SHOW_DELAY_MS = 100;
export const NAVIGATION_MIN_VISIBLE_MS = 240;
export const NAVIGATION_FAILSAFE_MS = 12_000;

export type NavigationPendingTimerId = number | ReturnType<typeof setTimeout>;

export type NavigationPendingClock = {
  now: () => number;
  schedule: (fn: () => void, ms: number) => NavigationPendingTimerId;
  cancel: (id: NavigationPendingTimerId) => void;
};

const defaultClock: NavigationPendingClock = {
  now: () => Date.now(),
  schedule: (fn, ms) => setTimeout(fn, ms),
  cancel: (id) => {
    clearTimeout(id);
  },
};

/**
 * Normalize `window.location.search` (`?q=1`) and `useSearchParams()` (`q=1`).
 */
export function navigationLocationKey(
  pathname: string,
  search: string,
): string {
  if (search === "" || search === "?") {
    return pathname;
  }
  return `${pathname}${search.startsWith("?") ? search : `?${search}`}`;
}

/**
 * Back/forward updates the URL before React. If they already match, starting
 * pending would never see a later location change and would stick.
 */
export function shouldStartPendingOnPopState(
  browserLocation: string,
  reactLocation: string,
): boolean {
  return browserLocation !== reactLocation;
}

export function createNavigationPendingMachine({
  onChange,
  clock = defaultClock,
  showDelayMs = NAVIGATION_SHOW_DELAY_MS,
  minVisibleMs = NAVIGATION_MIN_VISIBLE_MS,
  failsafeMs = NAVIGATION_FAILSAFE_MS,
}: {
  onChange: (pending: boolean) => void;
  clock?: NavigationPendingClock;
  showDelayMs?: number;
  minVisibleMs?: number;
  failsafeMs?: number;
}) {
  let showTimer: NavigationPendingTimerId | null = null;
  let hideTimer: NavigationPendingTimerId | null = null;
  let failsafeTimer: NavigationPendingTimerId | null = null;
  let shownAt: number | null = null;
  let pending = false;

  function setPending(next: boolean) {
    if (pending === next) {
      return;
    }
    pending = next;
    onChange(next);
  }

  function clearTimer(id: NavigationPendingTimerId | null) {
    if (id !== null) {
      clock.cancel(id);
    }
  }

  function start() {
    if (pending || showTimer !== null) {
      return;
    }
    clearTimer(hideTimer);
    hideTimer = null;
    showTimer = clock.schedule(() => {
      showTimer = null;
      shownAt = clock.now();
      setPending(true);
      failsafeTimer = clock.schedule(() => {
        failsafeTimer = null;
        shownAt = null;
        setPending(false);
      }, failsafeMs);
    }, showDelayMs);
  }

  function stop() {
    clearTimer(showTimer);
    showTimer = null;
    clearTimer(failsafeTimer);
    failsafeTimer = null;
    if (!pending) {
      return;
    }
    const elapsed = shownAt === null ? 0 : clock.now() - shownAt;
    const wait = Math.max(0, minVisibleMs - elapsed);
    hideTimer = clock.schedule(() => {
      hideTimer = null;
      shownAt = null;
      setPending(false);
    }, wait);
  }

  function dispose() {
    clearTimer(showTimer);
    clearTimer(hideTimer);
    clearTimer(failsafeTimer);
    showTimer = null;
    hideTimer = null;
    failsafeTimer = null;
    shownAt = null;
    setPending(false);
  }

  return { start, stop, dispose };
}
