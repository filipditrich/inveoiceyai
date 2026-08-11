import "server-only";

import { workspaces } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { issuerBusinesses } from "@invoicey/db";
import { eq, sql } from "drizzle-orm";

export type WorkspaceMetadata = {
  issuerWelcomeDismissedAt?: string;
  [key: string]: unknown;
};

/** Parse workspace.metadata text column as JSON object. */
export function parseWorkspaceMetadata(
  raw: string | null | undefined,
): WorkspaceMetadata {
  if (!raw?.trim()) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as WorkspaceMetadata;
    }
  } catch {
    /** ignore malformed metadata */
  }
  return {};
}

export function isIssuerWelcomeDismissed(metadata: WorkspaceMetadata): boolean {
  return typeof metadata.issuerWelcomeDismissedAt === "string";
}

/** True when workspace has zero issuers and welcome was not dismissed. */
export async function shouldGateIssuerWelcome(
  workspaceId: string,
): Promise<boolean> {
  const [countRow, workspace] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(issuerBusinesses)
      .where(eq(issuerBusinesses.workspaceId, workspaceId)),
    db
      .select({ metadata: workspaces.metadata })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1),
  ]);

  const count = countRow[0]?.count ?? 0;
  if (count > 0) {
    return false;
  }

  const meta = parseWorkspaceMetadata(workspace[0]?.metadata);
  return !isIssuerWelcomeDismissed(meta);
}

/** Persist skip-for-now on workspace metadata (no migration). */
export async function dismissIssuerWelcomeForWorkspace(
  workspaceId: string,
): Promise<void> {
  const rows = await db
    .select({ metadata: workspaces.metadata })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  const meta = parseWorkspaceMetadata(rows[0]?.metadata);
  meta.issuerWelcomeDismissedAt = new Date().toISOString();
  await db
    .update(workspaces)
    .set({ metadata: JSON.stringify(meta) })
    .where(eq(workspaces.id, workspaceId));
}

/**
 * Soft-gate paths that should send empty workspaces to /welcome.
 * Issuers, settings, and welcome itself are excluded.
 */
export function isIssuerWelcomeGatePath(pathname: string): boolean {
  if (
    pathname === "/welcome" ||
    pathname.startsWith("/welcome/") ||
    pathname === "/issuers" ||
    pathname.startsWith("/issuers/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/")
  ) {
    return false;
  }
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/invoices" ||
    pathname.startsWith("/invoices/") ||
    pathname === "/clients" ||
    pathname.startsWith("/clients/")
  );
}
