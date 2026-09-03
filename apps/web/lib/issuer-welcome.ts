import "server-only";
import { cache } from "react";
import { eq, sql } from "drizzle-orm";

import { workspaces } from "@invoicey/db";
import { issuerBusinesses } from "@invoicey/db";
import { db } from "@invoicey/db/client";

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
export const shouldGateIssuerWelcome = cache(
  async (workspaceId: string): Promise<boolean> => {
    // One round trip: this runs in the `(gated)` layout, so every dashboard,
    // invoice, and client page view pays for it, and for an established
    // workspace the answer is always "no".
    const [row] = await db
      .select({
        metadata: workspaces.metadata,
        hasIssuer: sql<boolean>`exists (
          select 1 from ${issuerBusinesses}
          where ${issuerBusinesses.workspaceId} = ${workspaceId}
        )`,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (!row || row.hasIssuer) {
      return false;
    }

    return !isIssuerWelcomeDismissed(parseWorkspaceMetadata(row.metadata));
  },
);

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
 * Soft-gate path helper (dashboard / invoices / clients).
 * Enforcement lives in the `(gated)` route-group layout — do not reintroduce
 * pathname-header checks in the app shell (stale `x-pathname` caused a
 * `/welcome` RSC redirect loop).
 */
export function isIssuerWelcomeGatePath(pathname: string): boolean {
  if (
    pathname === "/welcome" ||
    pathname.startsWith("/welcome/") ||
    pathname === "/issuers" ||
    pathname.startsWith("/issuers/") ||
    pathname === "/settings/account" ||
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
