import { AsyncLocalStorage } from "node:async_hooks";

import { getDefaultWorkspaceId } from "@invoicey/db";

export type InvoiceyRequestContext = {
  workspaceId: string;
  userId?: string;
};

const als = new AsyncLocalStorage<InvoiceyRequestContext>();

export function runWithInvoiceyContext<T>(
  ctx: InvoiceyRequestContext,
  fn: () => T,
): T {
  return als.run(ctx, fn);
}

/** Bind workspace for the rest of the current async resource (e.g. MCP verify). */
export function enterInvoiceyContext(ctx: InvoiceyRequestContext): void {
  als.enterWith(ctx);
}

export function getInvoiceyRequestContext():
  | InvoiceyRequestContext
  | undefined {
  return als.getStore();
}

/** Prefer explicit option, then ALS, then env default workspace. */
export function resolveWorkspaceId(explicit?: string | null): string {
  const trimmed = explicit?.trim();
  if (trimmed) return trimmed;
  const fromAls = als.getStore()?.workspaceId?.trim();
  if (fromAls) return fromAls;
  return getDefaultWorkspaceId();
}
