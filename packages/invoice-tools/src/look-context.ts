import {
  getWorkspaceEntitlements,
  listPublishedCommunityLookRows,
  listWorkspaceLookRows,
  workspaces,
  type InvoiceyDb,
} from "@invoicey/db";
import type { DbTransaction } from "@invoicey/db/transaction";
import {
  attachLookSnapshot,
  defaultLookRef,
  lookRefForNewDraft,
  LookDocumentSchema,
  resolveDraftLookRef,
  withoutLookSnapshot,
  type LookDocument,
  type LookRef,
} from "@invoicey/invoice-core/looks";
import type { Invoice } from "@invoicey/invoice-core/schema";
import { eq } from "drizzle-orm";

type Db = InvoiceyDb | DbTransaction;

export type WorkspaceLookContext = {
  apply: "classic" | "catalog";
  defaultLook: LookRef;
  catalog: LookDocument[];
};

function parseLookDocuments(
  rows: readonly { document: unknown }[],
): LookDocument[] {
  const looks: LookDocument[] = [];
  for (const row of rows) {
    const parsed = LookDocumentSchema.safeParse(row.document);
    if (parsed.success) looks.push(parsed.data);
  }
  return looks;
}

export async function loadWorkspaceLookContext(
  db: Db,
  workspaceId: string,
): Promise<WorkspaceLookContext> {
  const [entitled, [row], lookRows, communityRows] = await Promise.all([
    getWorkspaceEntitlements(db, workspaceId),
    db
      .select({
        defaultLookId: workspaces.defaultLookId,
        defaultLookVersion: workspaces.defaultLookVersion,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1),
    listWorkspaceLookRows(db, workspaceId),
    listPublishedCommunityLookRows(db),
  ]);

  return {
    apply: entitled?.entitlements.looks.apply ?? "classic",
    defaultLook: row
      ? { id: row.defaultLookId, version: row.defaultLookVersion }
      : defaultLookRef(),
    catalog: [
      ...parseLookDocuments(lookRows),
      ...parseLookDocuments(communityRows),
    ],
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
    context.catalog,
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
    catalog: context.catalog,
  });
  if (!resolved.ok) return resolved;
  return {
    ok: true,
    invoice: withoutLookSnapshot({ ...invoice, look: resolved.look }),
  };
}

export function snapshotLookAtIssue(
  invoice: Invoice,
  context: Pick<WorkspaceLookContext, "apply" | "catalog">,
):
  | { ok: true; invoice: Invoice }
  | { ok: false; error: "look_not_entitled" | "invalid_look" } {
  return attachLookSnapshot(invoice, context.apply, context.catalog);
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
