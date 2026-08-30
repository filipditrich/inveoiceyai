import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  emptyThreadStore,
  readThreadStore,
  titleFromEvents,
  upsertActiveThread,
  writeThreadStore,
} from "./assistant-threads";

const WORKSPACE = "ws_test";

class MemoryStorage {
  #map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.#map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.#map.set(key, value);
  }
  removeItem(key: string): void {
    this.#map.delete(key);
  }
  clear(): void {
    this.#map.clear();
  }
}

beforeEach(() => {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: storage },
  });
});

afterEach(() => {
  localStorage.clear();
});

describe("titleFromEvents", () => {
  it("uses the first received user message", () => {
    expect(
      titleFromEvents(
        [
          {
            type: "message.received",
            data: { text: "Which invoices are unpaid?" },
          },
        ] as never,
        "Fallback",
      ),
    ).toBe("Which invoices are unpaid?");
  });

  it("falls back when the log has no user text", () => {
    expect(titleFromEvents([], "New conversation")).toBe("New conversation");
  });
});

describe("thread store", () => {
  it("migrates the v1 single-thread key", () => {
    window.localStorage.setItem(
      `invoicey.assistant.${WORKSPACE}`,
      JSON.stringify({
        events: [
          { type: "message.received", data: { text: "Draft an invoice" } },
        ],
        session: { sessionId: "ses_1" },
      }),
    );

    const store = readThreadStore(WORKSPACE);
    expect(store.threads).toHaveLength(1);
    expect(store.threads[0]?.title).toBe("Draft an invoice");
    expect(store.activeId).toBe(store.threads[0]?.id);
  });

  it("keeps the newest thread first and drops the v1 key on write", () => {
    const first = upsertActiveThread(emptyThreadStore(), {
      id: "a",
      events: [],
      fallbackTitle: "A",
    });
    const next = upsertActiveThread(first, {
      id: "b",
      events: [{ type: "message.received", data: { text: "Hello" } }] as never,
      fallbackTitle: "B",
    });
    writeThreadStore(WORKSPACE, next);

    expect(
      window.localStorage.getItem(`invoicey.assistant.${WORKSPACE}`),
    ).toBeNull();
    const stored = readThreadStore(WORKSPACE);
    expect(stored.threads.map((thread) => thread.id)).toEqual(["b", "a"]);
    expect(stored.activeId).toBe("b");
  });
});
