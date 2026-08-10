import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { InvoiceyDb } from "./create-db";
import { presets } from "./schema";
import { ensureDefaultWorkspace, getDefaultWorkspaceId } from "./workspace";

export type PresetKind = "issuer" | "invoice_template";

export interface PresetRecord {
  id: string;
  kind: PresetKind;
  name: string;
  data: unknown;
}

function rowToRecord(row: typeof presets.$inferSelect): PresetRecord {
  return {
    id: row.id,
    kind: row.kind as PresetKind,
    name: row.name,
    data: row.data,
  };
}

export async function listPresetsDb(
  database: InvoiceyDb,
  options?: { workspaceId?: string; kind?: PresetKind },
): Promise<PresetRecord[]> {
  const workspaceId = options?.workspaceId ?? getDefaultWorkspaceId();
  await ensureDefaultWorkspace(database, { id: workspaceId });

  const rows =
    options?.kind == null
      ? await database
          .select()
          .from(presets)
          .where(eq(presets.workspaceId, workspaceId))
      : await database
          .select()
          .from(presets)
          .where(
            and(
              eq(presets.workspaceId, workspaceId),
              eq(presets.kind, options.kind),
            ),
          );

  return rows.map(rowToRecord);
}

export async function getPresetDb(
  database: InvoiceyDb,
  options: { id: string; workspaceId?: string },
): Promise<PresetRecord | null> {
  const workspaceId = options.workspaceId ?? getDefaultWorkspaceId();
  const rows = await database
    .select()
    .from(presets)
    .where(
      and(eq(presets.id, options.id), eq(presets.workspaceId, workspaceId)),
    )
    .limit(1);
  const row = rows[0];
  return row ? rowToRecord(row) : null;
}

export async function savePresetDb(
  database: InvoiceyDb,
  options: {
    id?: string;
    kind: PresetKind;
    name: string;
    data: unknown;
    workspaceId?: string;
  },
): Promise<PresetRecord> {
  const workspaceId = options.workspaceId ?? getDefaultWorkspaceId();
  await ensureDefaultWorkspace(database, { id: workspaceId });

  const id = options.id ?? randomUUID();
  const name = options.name.trim();
  const now = new Date();

  const existing = await database
    .select({ id: presets.id })
    .from(presets)
    .where(and(eq(presets.id, id), eq(presets.workspaceId, workspaceId)))
    .limit(1);

  if (existing[0]) {
    await database
      .update(presets)
      .set({
        kind: options.kind,
        name,
        data: options.data,
        updatedAt: now,
      })
      .where(eq(presets.id, id));
  } else {
    await database.insert(presets).values({
      id,
      workspaceId,
      kind: options.kind,
      name,
      data: options.data,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { id, kind: options.kind, name, data: options.data };
}

export async function deletePresetDb(
  database: InvoiceyDb,
  options: { id: string; workspaceId?: string },
): Promise<boolean> {
  const workspaceId = options.workspaceId ?? getDefaultWorkspaceId();
  const deleted = await database
    .delete(presets)
    .where(
      and(eq(presets.id, options.id), eq(presets.workspaceId, workspaceId)),
    )
    .returning({ id: presets.id });
  return deleted.length > 0;
}
