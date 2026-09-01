"use server";

import { requireWorkspace } from "@/lib/auth/session";
import { assertCan } from "@/lib/authz/can";
import { lookupAresByIcoCached } from "@/lib/cached-ares";
import { assertClientsWritable } from "@/lib/entitlements/managed-clients";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  clients,
  ensureClient,
  invoiceTemplates,
  invoices,
  mergeDuplicateClients,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import {
  ClientSnapshotSchema,
  ClientVatIdSchema,
  IcoSchema,
  type ClientSnapshot,
} from "@invoicey/invoice-core/schema";

function optionalTrim(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const s = value.trim();
  return s.length > 0 ? s : undefined;
}

function normalizeZip(zipRaw: string): string {
  const compact = zipRaw.replace(/\s/g, "");
  if (compact.length === 5 && /^\d{5}$/.test(compact)) {
    return `${compact.slice(0, 3)} ${compact.slice(3)}`;
  }
  return zipRaw.trim();
}

export type CreateClientFromAresResult =
  | {
      ok: true;
      client: {
        id: string;
        snapshot: ClientSnapshot;
      };
      existing: boolean;
    }
  | {
      ok: false;
      code: "invalid_ico" | "ares_no_data" | "ares_failed";
      message?: string;
    };

/** Resolve an IČO in the active workspace, creating the client from ARES when needed. */
export async function createClientFromAres(
  icoInput: string,
): Promise<CreateClientFromAresResult> {
  await assertCan("clients:manage");
  const { workspaceId } = await requireWorkspace();
  // A managed workspace bills only its plan catalog (ADR 0036), so an ARES
  // lookup here could only ever end in a client it may not use.
  await assertClientsWritable(workspaceId);
  const parsedIco = IcoSchema.safeParse((icoInput ?? "").replaceAll(/\s/g, ""));
  if (!parsedIco.success) {
    return { ok: false, code: "invalid_ico" };
  }

  const [existingRow] = await db
    .select({ id: clients.id, snapshot: clients.snapshot })
    .from(clients)
    .where(
      and(
        eq(clients.workspaceId, workspaceId),
        sql`regexp_replace(coalesce(${clients.snapshot}->>'ico', ''), '\\D', '', 'g') = ${parsedIco.data}`,
      ),
    )
    .limit(1);
  if (existingRow) {
    const existingSnapshot = ClientSnapshotSchema.safeParse(
      existingRow.snapshot,
    );
    if (existingSnapshot.success) {
      return {
        ok: true,
        client: { id: existingRow.id, snapshot: existingSnapshot.data },
        existing: true,
      };
    }
  }

  const lookup = await lookupAresByIcoCached(parsedIco.data);
  if (!lookup.ok) {
    return {
      ok: false,
      code: lookup.kind === "not_found" ? "ares_no_data" : "ares_failed",
      message: lookup.message,
    };
  }

  const preferredId = crypto.randomUUID();
  const parsedSnapshot = ClientSnapshotSchema.safeParse({
    id: preferredId,
    ...lookup.draft,
  });
  if (!parsedSnapshot.success) {
    return { ok: false, code: "ares_failed" };
  }
  const clientId = await ensureClient(
    db,
    workspaceId,
    parsedSnapshot.data as Record<string, unknown>,
    { preferredId, source: "ares" },
  );
  const snapshot = { ...parsedSnapshot.data, id: clientId };

  revalidatePath("/clients");
  revalidatePath("/invoices/new");
  return {
    ok: true,
    client: { id: clientId, snapshot },
    existing: false,
  };
}

/** UPSERT validated `ClientSnapshot` in default workspace. */
export async function saveClient(formData: FormData): Promise<void> {
  await assertCan("clients:manage");
  const { workspaceId } = await requireWorkspace();
  await assertClientsWritable(workspaceId);
  const rowId = optionalTrim(formData.get("id")) ?? crypto.randomUUID();
  const errBase = `/clients/${rowId}/edit`;
  const createBase = "/clients/new";

  const name = optionalTrim(formData.get("name")) ?? null;
  const street = optionalTrim(formData.get("street")) ?? null;
  const city = optionalTrim(formData.get("city")) ?? null;
  const zipNorm = optionalTrim(formData.get("zip"));
  const zipResolved = zipNorm ? normalizeZip(zipNorm) : null;
  const country = (optionalTrim(formData.get("country")) ?? "CZ").toUpperCase();

  if (!name || !street || !city || !zipResolved) {
    redirect(
      `${optionalTrim(formData.get("id")) ? errBase : createBase}?invalid=${encodeURIComponent("required_fields")}`,
    );
  }

  let icoParsed: string | undefined;
  const icoRaw = optionalTrim(formData.get("ico"));
  if (icoRaw) {
    const i = IcoSchema.safeParse(icoRaw.replace(/\s/g, ""));
    if (!i.success) {
      redirect(
        `${optionalTrim(formData.get("id")) ? errBase : createBase}?invalid=${encodeURIComponent("bad_ico")}`,
      );
    }
    icoParsed = i.data;
  }

  let dicParsed: string | undefined;
  const dicRaw = optionalTrim(formData.get("dic"));
  if (dicRaw) {
    const d = ClientVatIdSchema.safeParse(dicRaw);
    if (!d.success) {
      redirect(
        `${optionalTrim(formData.get("id")) ? errBase : createBase}?invalid=${encodeURIComponent("bad_dic")}`,
      );
    }
    dicParsed = d.data;
  }

  const emailParsed = optionalTrim(formData.get("contactEmail"));
  const sourceLabelRaw = formData.get("source")?.toString();
  const sourceLabel = sourceLabelRaw === "ares" ? "ares" : "manual";

  const snapshotCandidate = ClientSnapshotSchema.safeParse({
    id: rowId,
    name,
    ...(icoParsed !== undefined ? { ico: icoParsed } : {}),
    ...(dicParsed !== undefined ? { dic: dicParsed } : {}),
    address: {
      street,
      city,
      zip: zipResolved,
      country,
    },
    ...(emailParsed !== undefined ? { contactEmail: emailParsed } : {}),
  });

  if (!snapshotCandidate.success) {
    redirect(
      `${optionalTrim(formData.get("id")) ? errBase : createBase}?invalid=${encodeURIComponent("snapshot_validation")}`,
    );
  }

  const snapshot = snapshotCandidate.data;

  const existing = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, rowId), eq(clients.workspaceId, workspaceId)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(clients)
      .set({
        snapshot: snapshot as Record<string, unknown>,
        source: sourceLabel,
        updatedAt: new Date(),
      })
      .where(and(eq(clients.id, rowId), eq(clients.workspaceId, workspaceId)));
  } else {
    await ensureClient(db, workspaceId, snapshot as Record<string, unknown>, {
      preferredId: snapshot.id,
      source: sourceLabel,
    });
  }

  revalidatePath("/clients");
  revalidatePath("/invoices/new");
  redirect("/clients?toast=client_saved");
}

export async function deleteClient(formData: FormData): Promise<void> {
  const id = optionalTrim(formData.get("id"));
  const { workspaceId } = await requireWorkspace();
  await assertCan("clients:manage");
  await assertClientsWritable(workspaceId);
  if (!id) {
    redirect(`/clients?invalid=${encodeURIComponent("missing_id")}`);
  }
  const [invoiceRow] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(eq(invoices.clientId, id), eq(invoices.workspaceId, workspaceId)),
    )
    .limit(1);
  if (invoiceRow) {
    redirect(`/clients?invalid=${encodeURIComponent("has_client_invoices")}`);
  }
  const [templateRow] = await db
    .select({ id: invoiceTemplates.id })
    .from(invoiceTemplates)
    .where(
      and(
        eq(invoiceTemplates.clientId, id),
        eq(invoiceTemplates.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (templateRow) {
    redirect(`/clients?invalid=${encodeURIComponent("has_templates")}`);
  }
  await db
    .delete(clients)
    .where(and(eq(clients.id, id), eq(clients.workspaceId, workspaceId)));
  revalidatePath("/clients");
  redirect("/clients?toast=client_deleted");
}

/** Collapse duplicate clients by IČO or normalized legal name + full address. */
export async function mergeClientsAction(): Promise<void> {
  await assertCan("clients:manage");
  const { workspaceId } = await requireWorkspace();
  // Merging rewrites and removes client rows, so it is a client mutation like
  // any other — and on a managed workspace the catalog sync already guarantees
  // there is nothing to merge.
  await assertClientsWritable(workspaceId);
  const result = await mergeDuplicateClients(db, workspaceId);
  revalidatePath("/clients");
  revalidatePath("/invoices");
  redirect(
    `/clients?toast=clients_merged&groups=${result.mergedGroups}&removed=${result.clientsRemoved}&repointed=${result.invoicesRepointed}`,
  );
}
