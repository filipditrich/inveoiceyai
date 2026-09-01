import "server-only";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { securityAuditEvents, type SecurityAuditEventType } from "@invoicey/db";
import { db } from "@invoicey/db/client";

export async function recordSecurityAuditEvent(input: {
  userId?: string | null;
  workspaceId?: string | null;
  type: SecurityAuditEventType;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(securityAuditEvents).values({
      id: randomUUID(),
      userId: input.userId ?? null,
      workspaceId: input.workspaceId ?? null,
      type: input.type,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    console.error("[invoicey] security audit insert failed", err);
  }
}

export async function listSecurityAuditEventsForUser(
  userId: string,
  limit = 20,
) {
  return db
    .select()
    .from(securityAuditEvents)
    .where(eq(securityAuditEvents.userId, userId))
    .orderBy(desc(securityAuditEvents.createdAt))
    .limit(limit);
}
