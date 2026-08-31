import {
  getWorkspaceEntitlements,
  workspaces,
  type InvoiceyDb,
} from "@invoicey/db";
import type { DbTransaction } from "@invoicey/db/transaction";
import {
  attachLookSnapshot,
  defaultLookRef,
  lookRefForNewDraft,
  resolveDraftLookRef,
  withoutLookSnapshot,
  type LookRef,
} from "@invoicey/invoice-core/looks";
import type { Invoice } from "@invoicey/invoice-core/schema";
import { eq } from "drizzle-orm";

type Db = InvoiceyDb | DbTransaction;

export type WorkspaceLookContext = {
  apply: "classic" | "catalog";
  defaultLook: LookRef;
};

export async function loadWorkspaceLookContext(
  db: Db,
  workspaceId: string,
): Promise<WorkspaceLookContext> {
  const [entitled, [row]] = await Promise.all([
    getWorkspaceEntitlements(db, workspaceId),
    db
      .select({
        defaultLookId: workspaces.defaultLookId,
        defaultLookVersion: workspaces.defaultLookVersion,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1),
  ]);

  return {
    apply: entitled?.entitlements.looks.apply ?? "classic",
    defaultLook: row
      ? { id: row.defaultLookId, version: row.defaultLookVersion }
      : defaultLookRef(),
  };
}

export function applyLookToNewDraft(
  invoice: Invoice,
  context: WorkspaceLookContext,
): Invoice {
  const look = lookRefForNewDraft(
    context.apply,
    invoice.look,
    context.defaultLook,
  );
  return withoutLookSnapshot({ ...invoice, look });
}

export function applyLookToDraftWrite(
  invoice: Invoice,
  context: WorkspaceLookContext,
  existing?: LookRef,
):
  | { ok: true; invoice: Invoice }
  | { ok: false; error: "look_not_entitled" | "invalid_look" } {
  const resolved = resolveDraftLookRef(context.apply, invoice.look, {
    existing,
    workspaceDefault: context.defaultLook,
  });
  if (!resolved.ok) return resolved;
  return {
    ok: true,
    invoice: withoutLookSnapshot({ ...invoice, look: resolved.look }),
  };
}

export function snapshotLookAtIssue(
  invoice: Invoice,
  apply: "classic" | "catalog",
):
  | { ok: true; invoice: Invoice }
  | { ok: false; error: "look_not_entitled" | "invalid_look" } {
  return attachLookSnapshot(invoice, apply);
}

export function lookColumns(invoice: Invoice): {
  lookId: string | null;
  lookVersion: string | null;
} {
  return {
    lookId: invoice.look?.id ?? null,
    lookVersion: invoice.look?.version ?? null,
  };
}
