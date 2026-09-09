import { gt, isNull, lte, or } from "drizzle-orm";

import { bankConnections } from "@invoicey/db";

/** Connections a watcher is currently driving. */
export function connectionIsWatched(now: Date) {
  return gt(bankConnections.watchUntil, now);
}

/** Connections the sweep may cover, including ones that were never watched. */
export function connectionIsNotWatched(now: Date) {
  return or(
    isNull(bankConnections.watchUntil),
    lte(bankConnections.watchUntil, now),
  );
}
