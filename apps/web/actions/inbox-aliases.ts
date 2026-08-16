"use server";

import { inboxAliases, paymentAuditEvents } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireWorkspace, requireWorkspaceRole } from "@/lib/auth/session";

function localPart(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  const bytes = randomBytes(14);
  let out = "";
  for (const byte of bytes) {
    out += alphabet[byte % 32];
  }
  return `in-${out.slice(0, 22)}`;
}

export async function ensurePrimaryInboxAlias(): Promise<void> {
  const { workspaceId } = await requireWorkspace();
  const [existing] = await db
    .select({ id: inboxAliases.id })
    .from(inboxAliases)
    .where(
      and(
        eq(inboxAliases.workspaceId, workspaceId),
        eq(inboxAliases.isActive, true),
      ),
    )
    .limit(1);
  if (existing) return;
  await db.insert(inboxAliases).values({
    workspaceId,
    localPart: localPart(),
    label: "primary",
  });
}

export async function rotateInboxAliasAction(
  formData: FormData,
): Promise<void> {
  const { workspaceId, userId } = await requireWorkspaceRole("admin");
  const id = typeof formData.get("id") === "string" ? formData.get("id") : null;
  if (!id) {
    redirect("/settings/incoming-invoices?invalid=missing_id");
  }
  const [current] = await db
    .select()
    .from(inboxAliases)
    .where(
      and(
        eq(inboxAliases.id, String(id)),
        eq(inboxAliases.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!current) {
    redirect("/settings/incoming-invoices?invalid=not_found");
  }
  await db
    .update(inboxAliases)
    .set({ isActive: false, deactivatedAt: new Date() })
    .where(eq(inboxAliases.id, current.id));
  await db.insert(inboxAliases).values({
    workspaceId,
    issuerId: current.issuerId,
    localPart: localPart(),
    label: current.label,
    rotatedFromId: current.id,
  });
  await db.insert(paymentAuditEvents).values({
    workspaceId,
    action: "inbox_alias.rotated",
    actorType: "user",
    actorUserId: userId,
    entityType: "inbox_alias",
    entityId: current.id,
  });
  revalidatePath("/settings/incoming-invoices");
  redirect("/settings/incoming-invoices?toast=inbox_alias_rotated");
}
