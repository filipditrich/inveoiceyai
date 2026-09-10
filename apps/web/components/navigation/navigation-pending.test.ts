import { describe, expect, it } from "vitest";

import {
  createNavigationPendingMachine,
  navigationLocationKey,
  shouldStartPendingOnPopState,
  type NavigationPendingClock,
} from "./navigation-pending";

function createFakeClock(): NavigationPendingClock & {
  advance: (ms: number) => void;
} {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();

  return {
    now: () => now,
    schedule(fn, ms) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    cancel(id) {
      timers.delete(Number(id));
    },
    advance(ms) {
      now += ms;
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.at <= now)
        .sort((a, b) => a[1].at - b[1].at);
      for (const [id, timer] of due) {
        if (!timers.has(id)) {
          continue;
        }
        timers.delete(id);
        timer.fn();
      }
    },
  };
}

describe("navigationLocationKey", () => {
  it("treats window search and useSearchParams() as the same place", () => {
    expect(navigationLocationKey("/invoices", "?q=1")).toBe(
      navigationLocationKey("/invoices", "q=1"),
    );
    expect(navigationLocationKey("/invoices", "?")).toBe(
      navigationLocationKey("/invoices", ""),
    );
  });
});

describe("shouldStartPendingOnPopState", () => {
  it("does not start when React already committed the browser URL", () => {
    expect(shouldStartPendingOnPopState("/invoices", "/invoices")).toBe(false);
  });

  it("starts when the browser moved and React has not caught up", () => {
    expect(shouldStartPendingOnPopState("/invoices", "/invoices/abc")).toBe(
      true,
    );
  });
});

describe("createNavigationPendingMachine", () => {
  it("does not flip pending when the location commits before the show delay", () => {
    const clock = createFakeClock();
    let pending = false;
    const machine = createNavigationPendingMachine({
      clock,
      onChange: (next) => {
        pending = next;
      },
    });

    machine.start();
    clock.advance(50);
    machine.stop();
    clock.advance(100);

    expect(pending).toBe(false);
  });

  it("shows pending after the delay, then hides when the location commits", () => {
    const clock = createFakeClock();
    let pending = false;
    const machine = createNavigationPendingMachine({
      clock,
      onChange: (next) => {
        pending = next;
      },
    });

    machine.start();
    clock.advance(100);
    expect(pending).toBe(true);

    machine.stop();
    clock.advance(240);
    expect(pending).toBe(false);
  });

  it("clears pending when the location listener remounts onto the same machine", () => {
    const clock = createFakeClock();
    let pending = false;
    const machine = createNavigationPendingMachine({
      clock,
      onChange: (next) => {
        pending = next;
      },
    });

    machine.start();
    clock.advance(100);
    expect(pending).toBe(true);

    /** remounted useSearchParams() listener reports the committed url */
    machine.stop();
    clock.advance(240);
    expect(pending).toBe(false);
  });

  it("dispose forces pending off so a remount cannot leak the overlay", () => {
    const clock = createFakeClock();
    let pending = false;
    const machine = createNavigationPendingMachine({
      clock,
      onChange: (next) => {
        pending = next;
      },
    });

    machine.start();
    clock.advance(100);
    machine.dispose();

    expect(pending).toBe(false);
    clock.advance(12_000);
    expect(pending).toBe(false);
  });
});
