"use server";

import { ForbiddenError } from "@/lib/auth/errors";
import { requireWorkspace } from "@/lib/auth/session";
import { assertCan } from "@/lib/authz/can";
import {
  PERMISSIONS,
  PRESET_PERMISSIONS,
  presetForRole,
  type Permission,
} from "@/lib/authz/catalog";
import { requireEntitlements } from "@/lib/entitlements/entitlements";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { member } from "@invoicey/db";
import { db } from "@invoicey/db/client";

export interface MemberPermissionState {
  memberId: string;
  role: string;
  /** What the role preset already grants — the baseline the editor diffs from. */
  preset: Permission[];
  /** Effective set after overrides, for display. */
  effective: Permission[];
}

function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Stores per-member deviations from the role preset (ADR 0038).
 *
 * Takes the *desired effective set* and derives grant/deny from the preset,
 * rather than asking the caller to reason about the diff. That keeps the stored
 * override meaningful when the preset later changes: a permission the preset
 * gains stays granted unless it was explicitly denied.
 */
export async function saveMemberPermissionsAction(
  formData: FormData,
): Promise<void> {
  await assertCan("members:manage");
  const { workspaceId } = await requireWorkspace();

  const { entitlements } = await requireEntitlements();
  if (entitlements.permissions.mode !== "advanced") {
    throw new ForbiddenError("Plan does not include per-member permissions");
  }

  const memberId = String(formData.get("memberId") ?? "").trim();
  if (!memberId) {
    throw new ForbiddenError("Missing member");
  }

  const [row] = await db
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.organizationId, workspaceId)))
    .limit(1);
  if (!row) {
    // Scoped to the caller's workspace, so a member id from another tenant is
    // indistinguishable from one that does not exist.
    throw new ForbiddenError("Member not found");
  }

  // An owner's permissions are not editable: removing `workspace:manage` from
  // the last owner would leave a workspace nobody can administer.
  if (row.role === "owner") {
    throw new ForbiddenError("Owner permissions cannot be overridden");
  }

  const desired = new Set(
    formData.getAll("permission").map(String).filter(isPermission),
  );
  const preset = new Set(PRESET_PERMISSIONS[presetForRole(row.role)]);

  const grant = [...desired].filter((p) => !preset.has(p));
  const deny = [...preset].filter((p) => !desired.has(p));

  await db
    .update(member)
    .set({
      // Null rather than an empty object when the member matches their preset,
      // so "has overrides" stays a meaningful thing to query and display.
      permissionOverrides:
        grant.length === 0 && deny.length === 0 ? null : { grant, deny },
    })
    .where(eq(member.id, memberId));

  revalidatePath("/settings/workspace/members");
}
