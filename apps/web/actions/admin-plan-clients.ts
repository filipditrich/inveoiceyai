"use server";

import { removePlanClient, upsertPlanClient } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { ClientSnapshotSchema } from "@invoicey/invoice-core/schema";
import { IcoSchema } from "@invoicey/invoice-core/schema";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertPlatformAdmin } from "@/lib/auth/session";
import { lookupAresByIcoCached } from "@/lib/cached-ares";

/**
 * Adds one entity to a plan's managed client catalog, seeded from ARES.
 *
 * IČO-only input on purpose: the catalog is the definition of who a sponsored
 * workspace may invoice, and hand-typed addresses are exactly the thing that
 * would drift from the register.
 */
export async function addPlanClientAction(formData: FormData): Promise<void> {
  await assertPlatformAdmin();
  const planId = String(formData.get("planId") ?? "").trim();
  const target = `/admin/plans/${planId}`;

  const parsedIco = IcoSchema.safeParse(
    String(formData.get("ico") ?? "").replaceAll(/\s/g, ""),
  );
  if (!parsedIco.success) {
    redirect(`${target}?toast=admin_invalid_ico`);
  }

  const lookup = await lookupAresByIcoCached(parsedIco.data);
  if (!lookup.ok) {
    redirect(`${target}?toast=admin_ares_failed`);
  }

  const snapshot = ClientSnapshotSchema.safeParse({
    id: crypto.randomUUID(),
    ...lookup.draft,
  });
  if (!snapshot.success) {
    redirect(`${target}?toast=admin_ares_failed`);
  }

  await upsertPlanClient(db, {
    planId,
    ico: parsedIco.data,
    snapshot: snapshot.data as Record<string, unknown>,
  });

  revalidatePath(target);
  revalidatePath("/clients");
  redirect(`${target}?toast=admin_plan_client_added`);
}

/**
 * Drops an entity from the catalog. The synced copies stay in each workspace
 * as ordinary clients — deleting a counterparty someone has already invoiced
 * would damage history to enforce a rule about the future (ADR 0036).
 */
export async function removePlanClientAction(
  formData: FormData,
): Promise<void> {
  await assertPlatformAdmin();
  const planId = String(formData.get("planId") ?? "").trim();
  const planClientId = String(formData.get("planClientId") ?? "").trim();
  const target = `/admin/plans/${planId}`;

  await removePlanClient(db, planClientId);

  revalidatePath(target);
  revalidatePath("/clients");
  redirect(`${target}?toast=admin_plan_client_removed`);
}
