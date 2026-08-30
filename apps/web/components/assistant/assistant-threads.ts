import type { ClientSessionState, MessageStreamEvent } from "eve/client";

const STORAGE_VERSION = 2 as const;
const MAX_THREADS = 30;

export type AssistantThreadRecord = {
  id: string;
  title: string;
  updatedAt: number;
  events: readonly MessageStreamEvent[];
  session?: ClientSessionState;
};

export type AssistantThreadStore = {
  v: typeof STORAGE_VERSION;
  activeId: string | null;
  threads: AssistantThreadRecord[];
};

function storeKey(workspaceId: string): string {
  return `invoicey.assistant.threads.v${STORAGE_VERSION}.${workspaceId}`;
}

function legacyKey(workspaceId: string): string {
  return `invoicey.assistant.${workspaceId}`;
}

export function emptyThreadStore(): AssistantThreadStore {
  return { v: STORAGE_VERSION, activeId: null, threads: [] };
}

export function newThreadId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `thread_${Date.now().toString(36)}`;
}

export function titleFromEvents(
  events: readonly MessageStreamEvent[],
  fallback: string,
): string {
  for (const event of events) {
    if (event.type !== "message.received") continue;
    const text = textFromUnknown(event.data);
    if (text) return truncateTitle(text);
  }
  return fallback;
}

export function readThreadStore(workspaceId: string): AssistantThreadStore {
  try {
    const raw = window.localStorage.getItem(storeKey(workspaceId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AssistantThreadStore>;
      if (parsed.v === STORAGE_VERSION && Array.isArray(parsed.threads)) {
        return {
          v: STORAGE_VERSION,
          activeId:
            typeof parsed.activeId === "string" ? parsed.activeId : null,
          threads: parsed.threads.filter(isThreadRecord),
        };
      }
    }
  } catch {
    /** corrupt or blocked store — try the v1 key below */
  }

  return migrateLegacy(workspaceId);
}

export function writeThreadStore(
  workspaceId: string,
  store: AssistantThreadStore,
): void {
  const next: AssistantThreadStore = {
    v: STORAGE_VERSION,
    activeId: store.activeId,
    threads: store.threads
      .toSorted((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_THREADS),
  };
  try {
    window.localStorage.setItem(storeKey(workspaceId), JSON.stringify(next));
    window.localStorage.removeItem(legacyKey(workspaceId));
  } catch {
    /** quota or a private window — the server session is still durable */
  }
}

export function upsertActiveThread(
  store: AssistantThreadStore,
  patch: {
    id: string;
    events: readonly MessageStreamEvent[];
    session?: ClientSessionState;
    fallbackTitle: string;
  },
): AssistantThreadStore {
  const title = titleFromEvents(patch.events, patch.fallbackTitle);
  const record: AssistantThreadRecord = {
    id: patch.id,
    title,
    updatedAt: Date.now(),
    events: patch.events,
    session: patch.session,
  };
  const others = store.threads.filter((thread) => thread.id !== patch.id);
  return {
    v: STORAGE_VERSION,
    activeId: patch.id,
    threads: [record, ...others],
  };
}

function migrateLegacy(workspaceId: string): AssistantThreadStore {
  try {
    const raw = window.localStorage.getItem(legacyKey(workspaceId));
    if (!raw) return emptyThreadStore();
    const parsed = JSON.parse(raw) as {
      events?: readonly MessageStreamEvent[];
      session?: ClientSessionState;
    };
    const events = parsed.events ?? [];
    if (events.length === 0 && !parsed.session) return emptyThreadStore();
    const id = newThreadId();
    return {
      v: STORAGE_VERSION,
      activeId: id,
      threads: [
        {
          id,
          title: titleFromEvents(events, "Conversation"),
          updatedAt: Date.now(),
          events,
          session: parsed.session,
        },
      ],
    };
  } catch {
    return emptyThreadStore();
  }
}

function isThreadRecord(value: unknown): value is AssistantThreadRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<AssistantThreadRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.updatedAt === "number" &&
    Array.isArray(record.events)
  );
}

function textFromUnknown(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const record = data as { text?: unknown; message?: unknown };
  if (typeof record.text === "string" && record.text.trim()) {
    return record.text.trim();
  }
  if (typeof record.message === "string" && record.message.trim()) {
    return record.message.trim();
  }
  return "";
}

function truncateTitle(text: string): string {
  const compact = text.replace(/\s+/gu, " ").trim();
  if (compact.length <= 72) return compact;
  return `${compact.slice(0, 71).trimEnd()}…`;
}
