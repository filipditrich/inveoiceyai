"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ASSISTANT_CONTEXT_LIMIT_TOKENS } from "@/lib/assistant-limits";
import { useEveAgent, type UseEveAgentHelpers } from "eve/react";
import { usePathname } from "next/navigation";

import { contextTokensFromEvents } from "./assistant-context";
import { AssistantPanel } from "./assistant-panel";
import {
  newThreadId,
  readThreadStore,
  upsertActiveThread,
  writeThreadStore,
  type AssistantThreadRecord,
  type AssistantThreadStore,
} from "./assistant-threads";
import type { ClientSessionState, MessageStreamEvent } from "eve/client";
import type { EveMessageData } from "eve/react";

export interface AssistantBalance {
  giftedRemaining: number;
  monthlyRemaining: number;
  monthlyLimit: number;
  purchasedRemaining: number;
  totalAvailable: number;
  daysUntilRenewal: number;
}

export type AssistantThreadSummary = Pick<
  AssistantThreadRecord,
  "id" | "title" | "updatedAt"
>;

interface AssistantOpenValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

interface AssistantSessionValue {
  agent: UseEveAgentHelpers<EveMessageData>;
  balance: AssistantBalance | null;
  /** Starts a fresh durable session without dropping earlier threads. */
  newConversation: () => void;
  threads: AssistantThreadSummary[];
  activeThreadId: string | null;
  openThread: (id: string) => void;
  deleteThread: (id: string) => void;
  contextTokens: number;
  contextLimit: number;
}

const OpenContext = createContext<AssistantOpenValue | null>(null);
const SessionContext = createContext<AssistantSessionValue | null>(null);

export function useAssistant(): AssistantOpenValue {
  const value = useContext(OpenContext);
  if (!value) {
    throw new Error("useAssistant must be used inside <AssistantProvider>");
  }
  return value;
}

/** Null until the session mounts on the client. */
export function useAssistantSession(): AssistantSessionValue | null {
  return useContext(SessionContext);
}

/**
 * The in-app assistant.
 *
 * It is the same Eve agent Slack talks to, reached over the same `/eve/v1/*`
 * routes — `useEveAgent` needs no host because `withEve()` mounts them on this
 * origin. That is the whole point of the surface: identical tools, identical
 * "ask, don't guess" behavior, identical approvals, rendered as chat instead of
 * as a Slack thread.
 *
 * The hook lives here, above the panel, so closing the panel does not throw
 * away an in-flight turn or the conversation so far.
 */
export function AssistantProvider({
  children,
  workspaceId,
  initialBalance,
}: {
  children: ReactNode;
  workspaceId: string;
  initialBalance: AssistantBalance | null;
}) {
  const [open, setOpen] = useState(false);

  /**
   * The session reads persisted state synchronously when it mounts, which can
   * only happen after hydration — rendering it on the server would either
   * produce an empty thread the client immediately contradicts, or reach for
   * `localStorage` where there is none.
   */
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  const value = useMemo<AssistantOpenValue>(
    () => ({
      open,
      setOpen,
      toggle: () => setOpen((current) => !current),
    }),
    [open],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "j") return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      setOpen((current) => !current);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <OpenContext.Provider value={value}>
      {children}
      {hydrated ? (
        <AssistantSession
          initialBalance={initialBalance}
          workspaceId={workspaceId}
        />
      ) : null}
    </OpenContext.Provider>
  );
}

/** The hydration flag never changes after mount, so there is nothing to watch. */
function subscribeNever(): () => void {
  return () => {};
}

function AssistantSession({
  workspaceId,
  initialBalance,
}: {
  workspaceId: string;
  initialBalance: AssistantBalance | null;
}) {
  const pathname = usePathname();
  const [balance, setBalance] = useState(initialBalance);
  const [store, setStore] = useState<AssistantThreadStore>(() =>
    readThreadStore(workspaceId),
  );
  /** True while composing a thread that has not been persisted yet. */
  const [drafting, setDrafting] = useState(false);
  const [draftKey, setDraftKey] = useState(0);

  const persist = useCallback(
    (updater: (current: AssistantThreadStore) => AssistantThreadStore) => {
      setStore((current) => {
        const next = updater(current);
        writeThreadStore(workspaceId, next);
        return next;
      });
    },
    [workspaceId],
  );

  const newConversation = useCallback(() => {
    setDrafting(true);
    setDraftKey((key) => key + 1);
    persist((current) => ({ ...current, activeId: null }));
  }, [persist]);

  const openThread = useCallback(
    (id: string) => {
      setDrafting(false);
      persist((current) =>
        current.threads.some((thread) => thread.id === id)
          ? { ...current, activeId: id }
          : current,
      );
    },
    [persist],
  );

  const deleteThread = useCallback(
    (id: string) => {
      persist((current) => {
        const threads = current.threads.filter((thread) => thread.id !== id);
        const activeId =
          current.activeId === id ? (threads[0]?.id ?? null) : current.activeId;
        return { v: current.v, activeId, threads };
      });
    },
    [persist],
  );

  const saved =
    store.threads.find((thread) => thread.id === store.activeId) ??
    store.threads[0] ??
    null;
  const active = drafting ? null : saved;

  return (
    <AssistantSessionInner
      key={`${workspaceId}:${drafting ? `draft:${draftKey}` : (active?.id ?? "empty")}`}
      active={active}
      balance={balance}
      contextLimit={ASSISTANT_CONTEXT_LIMIT_TOKENS}
      deleteThread={deleteThread}
      newConversation={newConversation}
      onBalance={setBalance}
      onSnapshot={(snapshot) => {
        const id = active?.id ?? newThreadId();
        setDrafting(false);
        persist((current) =>
          upsertActiveThread(current, {
            id,
            events: snapshot.events,
            session: snapshot.session,
            fallbackTitle: snapshot.fallbackTitle,
          }),
        );
      }}
      openThread={openThread}
      pathname={pathname}
      threads={store.threads.filter((thread) => thread.events.length > 0)}
    />
  );
}

function AssistantSessionInner({
  pathname,
  balance,
  onBalance,
  onSnapshot,
  newConversation,
  threads,
  active,
  openThread,
  deleteThread,
  contextLimit,
}: {
  pathname: string;
  balance: AssistantBalance | null;
  onBalance: (balance: AssistantBalance) => void;
  onSnapshot: (snapshot: {
    events: readonly MessageStreamEvent[];
    session?: ClientSessionState;
    fallbackTitle: string;
  }) => void;
  newConversation: () => void;
  threads: AssistantThreadRecord[];
  active: AssistantThreadRecord | null;
  openThread: (id: string) => void;
  deleteThread: (id: string) => void;
  contextLimit: number;
}) {
  /**
   * `prepareSend` runs before every turn, so the agent always knows which
   * screen the question was asked from. It is ephemeral context — it never
   * lands in durable session history. `useEveAgent` re-registers its callbacks
   * on every render, so closing over `pathname` here always sees the current
   * route.
   */
  const agent = useEveAgent({
    initialEvents: active?.events ?? [],
    initialSession: active?.session,
    prepareSend: (input) => ({
      ...input,
      clientContext: {
        surface: "invoicey-web",
        route: pathname,
        ...invoiceIdFromPath(pathname),
      },
    }),
    onFinish: (snapshot) => {
      onSnapshot({
        events: snapshot.events,
        session: snapshot.session,
        fallbackTitle: firstUserText(snapshot.data.messages),
      });
      void refreshBalance(onBalance);
    },
  });

  const contextTokens = contextTokensFromEvents(agent.events);

  const value = useMemo<AssistantSessionValue>(
    () => ({
      agent,
      balance,
      newConversation,
      threads: threads.map(({ id, title, updatedAt }) => ({
        id,
        title,
        updatedAt,
      })),
      activeThreadId: active?.id ?? null,
      openThread,
      deleteThread,
      contextTokens,
      contextLimit,
    }),
    [
      active?.id,
      agent,
      balance,
      contextLimit,
      contextTokens,
      deleteThread,
      newConversation,
      openThread,
      threads,
    ],
  );

  return (
    <SessionContext.Provider value={value}>
      <AssistantPanel />
    </SessionContext.Provider>
  );
}

/** `/invoices/<uuid>` and its subroutes — the agent can act on it by id. */
function invoiceIdFromPath(pathname: string): { invoiceId?: string } {
  const match =
    /^\/invoices\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/|$)/iu.exec(
      pathname,
    );
  return match ? { invoiceId: match[1] } : {};
}

function firstUserText(
  messages: ReadonlyArray<{
    role: string;
    parts: ReadonlyArray<{ type: string; text?: string }>;
  }>,
): string {
  for (const message of messages) {
    if (message.role !== "user") continue;
    const text = message.parts
      .filter((part) => part.type === "text" && part.text)
      .map((part) => part.text)
      .join("\n")
      .trim();
    if (text) return text;
  }
  return "";
}

async function refreshBalance(
  onBalance: (balance: AssistantBalance) => void,
): Promise<void> {
  try {
    const res = await fetch("/api/assistant/balance", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { balance?: AssistantBalance };
    if (data.balance) onBalance(data.balance);
  } catch {
    /** the chip going stale is not worth surfacing */
  }
}
