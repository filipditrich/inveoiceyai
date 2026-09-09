import "server-only";
import { and, eq } from "drizzle-orm";

import { bankConnections } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import type { BankProvider } from "@invoicey/payment-core";

import { syncFioConnection } from "./fio-service";
import { syncMonetaConnection } from "./moneta-service";
import { millisecondsUntilPollAllowed } from "./provider-limits";

/**
 * How long one heartbeat keeps a connection under watch.
 *
 * Long enough that a payer fumbling with their banking app does not drop the
 * session, short enough that a closed laptop stops polling on its own. Every
 * status request pushes it out again, so an open screen renews it forever and
 * an abandoned one lapses.
 */
const WATCH_TTL_MS = 90_000;

export type WatchPollOutcome = {
  /** Whether this call actually spent a provider request. */
  polled: boolean;
  /** Wait before the next provider call is allowed. Zero once due. */
  retryAfterMs: number;
  imported: number;
  autoMatched: number;
  /** Set when the sync ran and genuinely failed — throttles are not failures. */
  error?: string;
};

function isBankProvider(value: string): value is BankProvider {
  return value === "fio" || value === "moneta";
}

/**
 * Heartbeats a watch on a connection and polls the provider when its floor has
 * elapsed.
 *
 * Every watcher of one connection funnels through here, so N people staring at
 * the same account still cost one provider request per interval — the property
 * that makes watching safe against Fio's 30s limit. Callers poll this far more
 * often than the floor and read state from the database in between.
 */
export async function heartbeatWatchAndPoll(input: {
  workspaceId: string;
  connectionId: string;
  now?: Date;
}): Promise<WatchPollOutcome> {
  const now = input.now ?? new Date();

  const [connection] = await db
    .update(bankConnections)
    .set({
      watchUntil: new Date(now.getTime() + WATCH_TTL_MS),
      updatedAt: now,
    })
    .where(
      and(
        eq(bankConnections.id, input.connectionId),
        eq(bankConnections.workspaceId, input.workspaceId),
        eq(bankConnections.status, "active"),
      ),
    )
    .returning({
      provider: bankConnections.provider,
      lastRequestAt: bankConnections.lastRequestAt,
    });

  if (!connection || !isBankProvider(connection.provider)) {
    return { polled: false, retryAfterMs: 0, imported: 0, autoMatched: 0 };
  }

  const retryAfterMs = millisecondsUntilPollAllowed({
    provider: connection.provider,
    lastRequestAt: connection.lastRequestAt,
    now,
  });
  if (retryAfterMs > 0) {
    return { polled: false, retryAfterMs, imported: 0, autoMatched: 0 };
  }

  const result =
    connection.provider === "moneta"
      ? await syncMonetaConnection({
          workspaceId: input.workspaceId,
          connectionId: input.connectionId,
        })
      : await syncFioConnection({
          workspaceId: input.workspaceId,
          connectionId: input.connectionId,
        });

  // Losing the race to another watcher or the sweep is the system working:
  // that run is fetching the same movements this one wanted.
  if (result.skipped) {
    return {
      polled: false,
      retryAfterMs: millisecondsUntilPollAllowed({
        provider: connection.provider,
        lastRequestAt: now,
        now,
      }),
      imported: 0,
      autoMatched: 0,
    };
  }

  return {
    polled: true,
    retryAfterMs: millisecondsUntilPollAllowed({
      provider: connection.provider,
      lastRequestAt: now,
      now,
    }),
    imported: result.imported,
    autoMatched: result.autoMatched,
    error: result.ok ? undefined : result.error,
  };
}
