"use server";

import { ensureSupplier, supplierBankAccounts, suppliers } from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireWorkspace, requireWorkspaceRole } from "@/lib/auth/session";

function optionalTrim(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function saveSupplier(formData: FormData): Promise<void> {
  const { workspaceId } = await requireWorkspace();
  const name = optionalTrim(formData.get("name"));
  if (!name) {
    redirect("/suppliers?invalid=missing_name");
  }
  const id = optionalTrim(formData.get("id"));
  if (id) {
    await db
      .update(suppliers)
      .set({
        name,
        ico: optionalTrim(formData.get("ico")),
        dic: optionalTrim(formData.get("dic")),
        notes: optionalTrim(formData.get("notes")),
        isTrusted: formData.get("isTrusted") === "on",
        updatedAt: new Date(),
      })
      .where(and(eq(suppliers.id, id), eq(suppliers.workspaceId, workspaceId)));
  } else {
    await ensureSupplier(db, {
      workspaceId,
      name,
      ico: optionalTrim(formData.get("ico")),
      dic: optionalTrim(formData.get("dic")),
      source: "manual",
    });
  }
  revalidatePath("/suppliers");
  redirect("/suppliers?toast=supplier_saved");
}

export async function confirmSupplierBankAccount(
  formData: FormData,
): Promise<void> {
  const { workspaceId, userId } = await requireWorkspaceRole("admin");
  const id = optionalTrim(formData.get("id"));
  const supplierId = optionalTrim(formData.get("supplierId"));
  if (!id || !supplierId) {
    redirect("/suppliers?invalid=missing_id");
  }
  await db
    .update(supplierBankAccounts)
    .set({
      confirmedAt: new Date(),
      confirmedByUserId: userId,
    })
    .where(
      and(
        eq(supplierBankAccounts.id, id),
        eq(supplierBankAccounts.workspaceId, workspaceId),
      ),
    );
  revalidatePath(`/suppliers/${supplierId}`);
  redirect(`/suppliers/${supplierId}?toast=supplier_account_confirmed`);
}
