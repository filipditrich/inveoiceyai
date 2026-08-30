"use server";

import { invitation } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isTrustedInvoiceImageUrl } from "@invoicey/invoice-core";

import { auth } from "@/lib/auth/auth";
import { ForbiddenError } from "@/lib/auth/errors";
import { recordSecurityAuditEvent } from "@/lib/auth/security-audit";
import { assertWorkspaceMember, requireSession } from "@/lib/auth/session";
import { assertCan } from "@/lib/authz/can";
import {
  isOrganizationSlugConflict,
  randomSlugSuffix,
  setUserDefaultWorkspace,
  slugifyWorkspaceName,
} from "@/lib/auth/workspaces";

export type WorkspaceActionErrorCode =
  | "name_required"
  | "switch_failed"
  | "create_failed"
  | "update_failed"
  | "logo_invalid"
  | "default_failed"
  | "invite_failed"
  | "invite_missing_workspace"
  | "forbidden";

export type WorkspaceActionResult =
  { ok: true } | { ok: false; errorCode: WorkspaceActionErrorCode };

function actionError(
  error: unknown,
  fallback: WorkspaceActionErrorCode,
): WorkspaceActionResult {
  if (error instanceof ForbiddenError) {
    return { ok: false, errorCode: "forbidden" };
  }
  return { ok: false, errorCode: fallback };
}

/**
 * Sets session active org and PAT default to the same workspace, then lands on
 * the dashboard so deep links from the previous tenant cannot 404.
 */
export async function switchWorkspaceAction(
  organizationId: string,
): Promise<WorkspaceActionResult> {
  try {
    const user = await requireSession();
    await assertWorkspaceMember(organizationId);
    await auth.api.setActiveOrganization({
      headers: await headers(),
      body: { organizationId },
    });
    await setUserDefaultWorkspace(user.id, organizationId);
    revalidatePath("/", "layout");
  } catch (error) {
    return actionError(error, "switch_failed");
  }

  redirect("/dashboard");
}

/**
 * Creates a workspace via Better Auth, makes it active + default, then
 * redirects to the dashboard (issuer welcome gate still applies). The logo is
 * set at creation so a new workspace is recognisable in the switcher straight
 * away instead of showing two grey initials until someone visits settings.
 */
export async function createWorkspaceAction(input: {
  name: string;
  logo?: string | null;
}): Promise<WorkspaceActionResult> {
  const trimmed = input.name.trim();
  if (!trimmed) {
    return { ok: false, errorCode: "name_required" };
  }

  const logo = input.logo?.trim() || "";
  if (logo && !isTrustedInvoiceImageUrl(logo)) {
    return { ok: false, errorCode: "logo_invalid" };
  }

  let createdId: string | undefined;

  try {
    const user = await requireSession();
    const hdrs = await headers();
    const base = slugifyWorkspaceName(trimmed);
    let slug = base;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const org = await auth.api.createOrganization({
          headers: hdrs,
          body: { name: trimmed, slug, ...(logo ? { logo } : {}) },
        });
        createdId = org.id;
        break;
      } catch (error) {
        if (attempt >= 4 || !isOrganizationSlugConflict(error)) {
          throw error;
        }
        slug = `${base}-${randomSlugSuffix()}`;
      }
    }

    if (!createdId) {
      return { ok: false, errorCode: "create_failed" };
    }

    await setUserDefaultWorkspace(user.id, createdId);
    revalidatePath("/", "layout");
  } catch (error) {
    return actionError(error, "create_failed");
  }

  redirect("/dashboard");
}

/** Rename and/or set the chrome logo of the active workspace (owner/admin). */
export async function updateWorkspaceAction(input: {
  name?: string;
  logo?: string | null;
}): Promise<WorkspaceActionResult> {
  const hasName = input.name !== undefined;
  const hasLogo = input.logo !== undefined;
  if (!hasName && !hasLogo) {
    return { ok: false, errorCode: "update_failed" };
  }

  const data: { name?: string; logo?: string } = {};

  if (hasName) {
    const trimmed = (input.name ?? "").trim();
    if (!trimmed) {
      return { ok: false, errorCode: "name_required" };
    }
    data.name = trimmed;
  }

  if (hasLogo) {
    const logo = input.logo?.trim() || "";
    if (logo && !isTrustedInvoiceImageUrl(logo)) {
      return { ok: false, errorCode: "logo_invalid" };
    }
    data.logo = logo;
  }

  try {
    await assertCan("workspace:manage");
    await auth.api.updateOrganization({
      headers: await headers(),
      body: { data },
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return actionError(error, "update_failed");
  }
}

/**
 * Updates PAT/MCP default without changing the browser active workspace.
 * Use from API keys settings when the user wants keys to target another org.
 */
export async function setDefaultWorkspaceAction(
  organizationId: string,
): Promise<WorkspaceActionResult> {
  try {
    const user = await requireSession();
    await assertWorkspaceMember(organizationId);
    await setUserDefaultWorkspace(user.id, organizationId);
    revalidatePath("/settings/workspace/api-keys");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return actionError(error, "default_failed");
  }
}

/**
 * Accepts an invite, then aligns PAT default with the invited workspace.
 * Better Auth already sets `activeOrganizationId` on accept.
 */
export async function acceptWorkspaceInviteAction(
  invitationId: string,
): Promise<WorkspaceActionResult> {
  try {
    const user = await requireSession();
    const [inviteRow] = await db
      .select({ organizationId: invitation.organizationId })
      .from(invitation)
      .where(eq(invitation.id, invitationId))
      .limit(1);

    const result = await auth.api.acceptInvitation({
      headers: await headers(),
      body: { invitationId },
    });

    const organizationId =
      result?.invitation?.organizationId ??
      result?.member?.organizationId ??
      inviteRow?.organizationId;

    if (!organizationId) {
      return { ok: false, errorCode: "invite_missing_workspace" };
    }

    await setUserDefaultWorkspace(user.id, organizationId);
    await recordSecurityAuditEvent({
      userId: user.id,
      workspaceId: organizationId,
      type: "invite_accept",
      metadata: { invitationId, organizationId },
    });
    revalidatePath("/", "layout");
  } catch (error) {
    return actionError(error, "invite_failed");
  }

  redirect("/dashboard");
}
