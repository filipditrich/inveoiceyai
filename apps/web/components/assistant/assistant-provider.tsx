"use client";

import { useEveAgent, type UseEveAgentHelpers } from "eve/react";
import type { EveMessageData } from "eve/react";
import type { ClientSessionState, MessageStreamEvent } from "eve/client";
import { usePathname } from "next/navigation";
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

import { AssistantPanel } from "./assistant-panel";

export interface AssistantBalance {
  giftedRemaining: number;
  monthlyRemaining: number;
  monthlyLimit: number;
  purchasedRemaining: number;
  totalAvailable: number;
  daysUntilRenewal: number;
}

interface AssistantOpenValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

interface AssistantSessionValue {
  agent: UseEveAgentHelpers<EveMessageData>;
  balance: AssistantBalance | null;
  /** Clears the thread and starts a fresh durable session. */
  newConversation: () => void;
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

type SavedChat = {
  events?: readonly MessageStreamEvent[];
  session?: ClientSessionState;
};

/** One saved thread per workspace, so switching workspaces cannot cross them. */
function storageKey(workspaceId: string): string {
  return `invoicey.assistant.${workspaceId}`;
}

function readSaved(workspaceId: string): SavedChat {
  try {
    const raw = window.localStorage.getItem(storageKey(workspaceId));
    return raw ? (JSON.parse(raw) as SavedChat) : {};
  } catch {
    return {};
  }
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
  /** Bumped by "New conversation" to remount the hook with a clean store. */
  const [threadKey, setThreadKey] = useState(0);

  const newConversation = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey(workspaceId));
    } catch {
      /** a blocked store is not a reason to refuse a new thread */
    }
    setThreadKey((key) => key + 1);
  }, [workspaceId]);

  return (
    <AssistantSessionInner
      key={`${workspaceId}:${threadKey}`}
      balance={balance}
      newConversation={newConversation}
      onBalance={setBalance}
      pathname={pathname}
      workspaceId={workspaceId}
    />
  );
}

function AssistantSessionInner({
  workspaceId,
  pathname,
  balance,
  onBalance,
  newConversation,
}: {
  workspaceId: string;
  pathname: string;
  balance: AssistantBalance | null;
  onBalance: (balance: AssistantBalance) => void;
  newConversation: () => void;
}) {
  const [saved] = useState<SavedChat>(() => readSaved(workspaceId));

  /**
   * `prepareSend` runs before every turn, so the agent always knows which
   * screen the question was asked from. It is ephemeral context — it never
   * lands in durable session history. `useEveAgent` re-registers its callbacks
   * on every render, so closing over `pathname` here always sees the current
   * route.
   */
  const agent = useEveAgent({
    initialEvents: saved.events ?? [],
    initialSession: saved.session,
    prepareSend: (input) => ({
      ...input,
      clientContext: {
        surface: "invoicey-web",
        route: pathname,
        ...invoiceIdFromPath(pathname),
      },
    }),
    onFinish: (snapshot) => {
      try {
        window.localStorage.setItem(
          storageKey(workspaceId),
          JSON.stringify({
            events: snapshot.events,
            session: snapshot.session,
          }),
        );
      } catch {
        /** quota or a private window — the server session is still durable */
      }
      void refreshBalance(onBalance);
    },
  });

  const value = useMemo<AssistantSessionValue>(
    () => ({ agent, balance, newConversation }),
    [agent, balance, newConversation],
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
