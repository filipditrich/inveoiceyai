"use server";

import { requireWorkspace } from "@/lib/auth/session";
import {
  ClientSnapshotSchema,
  ClientVatIdSchema,
  IcoSchema,
} from "@invoicey/invoice-core/schema";
import { clients, ensureClient, mergeDuplicateClients } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

/** UPSERT validated `ClientSnapshot` in default workspace. */
export async function saveClient(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspace();
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
  if (!id) {
    redirect(`/clients?invalid=${encodeURIComponent("missing_id")}`);
  }
  await db
    .delete(clients)
    .where(and(eq(clients.id, id), eq(clients.workspaceId, workspaceId)));
  revalidatePath("/clients");
  redirect("/clients?toast=client_deleted");
}

/** Collapse duplicate clients (by IČO, else by name when IČO absent). */
export async function mergeClientsAction(): Promise<void> {
  const { workspaceId } = await requireWorkspace();
  const result = await mergeDuplicateClients(db, workspaceId);
  revalidatePath("/clients");
  revalidatePath("/invoices");
  redirect(
    `/clients?toast=clients_merged&groups=${result.mergedGroups}&removed=${result.clientsRemoved}&repointed=${result.invoicesRepointed}`,
  );
}
