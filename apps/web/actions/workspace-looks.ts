"use server";

import {
  deleteWorkspaceLookRows,
  insertWorkspaceLookRow,
  listWorkspaceLookRows,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
  bumpLookVersion,
  canApplyLook,
  compareLookSemver,
  findLookDocument,
  getFirstPartyLook,
  LookDocumentSchema,
  lookContentEquals,
  lookDocumentIsValid,
  versionBumpForLookChange,
  workspaceLookFrom,
  type LookDocument,
} from "@invoicey/invoice-core/looks";
import { loadWorkspaceLookContext } from "@invoicey/invoice-tools/ops";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireWorkspace } from "@/lib/auth/session";

export type WorkspaceLookActionError =
  | "forbidden"
  | "look_not_entitled"
  | "invalid_look"
  | "reserved_look_id"
  | "invalid_look_id"
  | "slug_taken"
  | "look_in_use"
  | "save_failed";

export type WorkspaceLookActionResult =
  | { ok: true; look: LookDocument }
  | { ok: false; errorCode: WorkspaceLookActionError };

async function requireLookEditor(): Promise<
  | {
      ok: true;
      workspaceId: string;
      apply: "classic" | "catalog";
      catalog: LookDocument[];
      defaultLook: { id: string; version: string };
    }
  | { ok: false; errorCode: WorkspaceLookActionError }
> {
  const { workspaceId, role } = await requireWorkspace();
  if (role !== "owner" && role !== "admin") {
    return { ok: false, errorCode: "forbidden" };
  }
  const context = await loadWorkspaceLookContext(db, workspaceId);
  if (!canApplyLook(context.apply, "minimal")) {
    return { ok: false, errorCode: "look_not_entitled" };
  }
  return {
    ok: true,
    workspaceId,
    apply: context.apply,
    catalog: context.catalog,
    defaultLook: context.defaultLook,
  };
}

export async function createWorkspaceLookAction(input: {
  sourceId: "classic" | "minimal";
  id: string;
  name: string;
}): Promise<WorkspaceLookActionResult> {
  const gate = await requireLookEditor();
  if (!gate.ok) return gate;
  const source = getFirstPartyLook(input.sourceId, "1.0.0");
  if (!source) return { ok: false, errorCode: "invalid_look" };
  const created = workspaceLookFrom(source, {
    id: input.id.trim(),
    name: input.name.trim(),
  });
  if (!created.ok) return { ok: false, errorCode: created.error };
  if (!lookDocumentIsValid(created.look)) {
    return { ok: false, errorCode: "invalid_look" };
  }
  if (gate.catalog.some((look) => look.id === created.look.id)) {
    return { ok: false, errorCode: "slug_taken" };
  }
  try {
    await insertWorkspaceLookRow(db, {
      workspaceId: gate.workspaceId,
      lookId: created.look.id,
      version: created.look.version,
      document: created.look as Record<string, unknown>,
    });
  } catch {
    return { ok: false, errorCode: "slug_taken" };
  }
  revalidatePath("/settings/workspace/looks");
  revalidatePath("/settings/workspace");
  revalidatePath("/invoices/new");
  redirect(`/settings/workspace/looks/${created.look.id}`);
}

export async function saveWorkspaceLookAction(input: {
  look: unknown;
}): Promise<WorkspaceLookActionResult> {
  const gate = await requireLookEditor();
  if (!gate.ok) return gate;
  const parsed = LookDocumentSchema.safeParse(input.look);
  if (!parsed.success || parsed.data.origin !== "workspace") {
    return { ok: false, errorCode: "invalid_look" };
  }
  if (!lookDocumentIsValid(parsed.data)) {
    return { ok: false, errorCode: "invalid_look" };
  }
  const previous = gate.catalog
    .filter((look) => look.id === parsed.data.id)
    .sort((a, b) => compareLookSemver(b.version, a.version))[0];
  if (!previous) {
    return { ok: false, errorCode: "invalid_look" };
  }
  if (lookContentEquals(previous, parsed.data)) {
    return { ok: true, look: previous };
  }
  const version = bumpLookVersion(
    previous.version,
    versionBumpForLookChange(previous, parsed.data),
  );
  const next: LookDocument = {
    ...parsed.data,
    id: previous.id,
    origin: "workspace",
    version,
  };
  if (!lookDocumentIsValid(next)) {
    return { ok: false, errorCode: "invalid_look" };
  }
  if (findLookDocument(next.id, next.version, gate.catalog)) {
    return { ok: false, errorCode: "slug_taken" };
  }
  try {
    await insertWorkspaceLookRow(db, {
      workspaceId: gate.workspaceId,
      lookId: next.id,
      version: next.version,
      document: next as Record<string, unknown>,
    });
  } catch {
    return { ok: false, errorCode: "save_failed" };
  }
  revalidatePath("/settings/workspace/looks");
  revalidatePath(`/settings/workspace/looks/${next.id}`);
  revalidatePath("/settings/workspace");
  revalidatePath("/invoices/new");
  return { ok: true, look: next };
}

export async function deleteWorkspaceLookAction(input: {
  lookId: string;
}): Promise<{ ok: true } | { ok: false; errorCode: WorkspaceLookActionError }> {
  const gate = await requireLookEditor();
  if (!gate.ok) return gate;
  if (gate.defaultLook.id === input.lookId) {
    return { ok: false, errorCode: "look_in_use" };
  }
  const rows = await listWorkspaceLookRows(db, gate.workspaceId);
  if (!rows.some((row) => row.lookId === input.lookId)) {
    return { ok: false, errorCode: "invalid_look" };
  }
  await deleteWorkspaceLookRows(db, gate.workspaceId, input.lookId);
  revalidatePath("/settings/workspace/looks");
  revalidatePath("/settings/workspace");
  revalidatePath("/invoices/new");
  return { ok: true };
}
