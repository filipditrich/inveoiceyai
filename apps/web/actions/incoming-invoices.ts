"use server";

import {
  acceptIncomingInvoice,
  createUploadInboxItem,
  deleteIncomingInvoice,
  incomingInvoices,
  rejectIncomingInvoice,
  spawnApprovalForAcceptedInvoice,
  suppliers,
} from "@invoicey/db";
import { db } from "@invoicey/db/client";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireWorkspace } from "@/lib/auth/session";
import { processIncomingDocument } from "@/lib/incoming-invoices/process-document";
import {
  incomingActionPath,
  safeIncomingReturnTo,
} from "@/lib/incoming-invoices/safe-return-to";

function optionalTrim(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function processIncomingUploads(input: {
  files: Array<{ url: string; name: string; type: string }>;
  issuerId?: string | null;
}): Promise<{ ok: true; invoiceIds: string[] } | { ok: false; error: string }> {
  const { workspaceId, userId } = await requireWorkspace();
  if (input.files.length === 0) {
    return { ok: false, error: "missing_files" };
  }
  const inboxItemId = await createUploadInboxItem(db, {
    workspaceId,
    userId,
    issuerId: input.issuerId,
  });
  const invoiceIds: string[] = [];
  for (const file of input.files) {
    const result = await processIncomingDocument({
      workspaceId,
      inboxItemId,
      issuerId: input.issuerId,
      fileUrl: file.url,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
    });
    if (result.invoiceId) {
      invoiceIds.push(result.invoiceId);
    }
  }
  revalidatePath("/incoming-invoices");
  return { ok: true, invoiceIds };
}

export async function updateIncomingInvoiceFields(
  formData: FormData,
): Promise<void> {
  const { workspaceId } = await requireWorkspace();
  const id = optionalTrim(formData.get("id"));
  if (!id) {
    redirect("/incoming-invoices?invalid=missing_id");
  }
  const [row] = await db
    .select({ id: incomingInvoices.id, status: incomingInvoices.status })
    .from(incomingInvoices)
    .where(
      and(
        eq(incomingInvoices.id, id),
        eq(incomingInvoices.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!row) {
    redirect("/incoming-invoices?invalid=not_found");
  }
  if (row.status !== "needs_validation" && row.status !== "on_hold") {
    redirect(`/incoming-invoices/${id}?invalid=not_reviewable`);
  }
  await db
    .update(incomingInvoices)
    .set({
      number: optionalTrim(formData.get("number")),
      numberNormalized:
        optionalTrim(formData.get("number"))
          ?.toUpperCase()
          .replaceAll(/[^A-Z0-9]/gu, "") ?? null,
      issueDate: optionalTrim(formData.get("issueDate")),
      taxDate: optionalTrim(formData.get("taxDate")),
      dueDate: optionalTrim(formData.get("dueDate")),
      currency: optionalTrim(formData.get("currency")) ?? "CZK",
      total: optionalTrim(formData.get("total")),
      subtotal: optionalTrim(formData.get("subtotal")),
      vatTotal: optionalTrim(formData.get("vatTotal")),
      variableSymbol: optionalTrim(formData.get("variableSymbol")),
      beneficiaryIban: optionalTrim(formData.get("beneficiaryIban")),
      beneficiaryAccountNumber: optionalTrim(
        formData.get("beneficiaryAccountNumber"),
      ),
      beneficiaryBankCode: optionalTrim(formData.get("beneficiaryBankCode")),
      notes: optionalTrim(formData.get("notes")),
      updatedAt: new Date(),
    })
    .where(eq(incomingInvoices.id, id));
  revalidatePath(`/incoming-invoices/${id}`);
  redirect(`/incoming-invoices/${id}?toast=incoming_saved`);
}

export async function acceptIncomingInvoiceAction(
  formData: FormData,
): Promise<void> {
  const { workspaceId, userId } = await requireWorkspace();
  const id = optionalTrim(formData.get("id"));
  const returnTo = safeIncomingReturnTo(formData.get("returnTo"));
  if (!id) {
    redirect("/incoming-invoices?invalid=missing_id");
  }
  const result = await acceptIncomingInvoice({
    workspaceId,
    invoiceId: id,
    actorUserId: userId,
  });
  if (!result.ok) {
    redirect(
      incomingActionPath({
        returnTo,
        fallback: `/incoming-invoices/${id}`,
        invalid: result.error,
      }),
    );
  }
  const [invoice] = await db
    .select()
    .from(incomingInvoices)
    .where(eq(incomingInvoices.id, id))
    .limit(1);
  const [supplier] = invoice?.supplierId
    ? await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, invoice.supplierId))
        .limit(1)
    : [];
  await spawnApprovalForAcceptedInvoice({
    workspaceId,
    invoiceId: id,
    validatedByUserId: userId,
    facts: {
      issuerId: invoice?.issuerId,
      supplierId: invoice?.supplierId,
      supplierIco: invoice?.supplierIcoRaw,
      supplierIsTrusted: supplier?.isTrusted ?? false,
      supplierIsNew: false,
      docType: invoice?.docType ?? "invoice",
      currency: invoice?.currency ?? "CZK",
      total: invoice?.total ?? "0",
      newBeneficiaryAccount: (invoice?.exceptionCodes ?? []).includes(
        "new_beneficiary_account",
      ),
      extractionSource: invoice?.extractionSource ?? "manual",
      hasExceptions: (invoice?.exceptionCodes ?? []).length > 0,
      lowConfidence: (invoice?.exceptionCodes ?? []).includes("low_confidence"),
    },
  });
  const nextId = optionalTrim(formData.get("nextId"));
  const nextPath =
    nextId && /^[0-9a-f-]{36}$/iu.test(nextId)
      ? `/incoming-invoices/${nextId}`
      : `/incoming-invoices/${id}`;
  revalidatePath("/incoming-invoices");
  redirect(
    incomingActionPath({
      returnTo,
      fallback: nextPath,
      toast: "incoming_accepted",
    }),
  );
}

export async function rejectIncomingInvoiceAction(
  formData: FormData,
): Promise<void> {
  const { workspaceId, userId } = await requireWorkspace();
  const id = optionalTrim(formData.get("id"));
  const reason = optionalTrim(formData.get("reason"));
  const returnTo = safeIncomingReturnTo(formData.get("returnTo"));
  if (!id) {
    redirect("/incoming-invoices?invalid=missing_id");
  }
  if (!reason) {
    redirect(
      incomingActionPath({
        returnTo,
        fallback: `/incoming-invoices/${id}`,
        invalid: "reason_required",
      }),
    );
  }
  const result = await rejectIncomingInvoice({
    workspaceId,
    invoiceId: id,
    actorUserId: userId,
    reason,
  });
  if (!result.ok) {
    redirect(
      incomingActionPath({
        returnTo,
        fallback: `/incoming-invoices/${id}`,
        invalid: result.error,
      }),
    );
  }
  revalidatePath("/incoming-invoices");
  redirect(
    incomingActionPath({
      returnTo,
      fallback: `/incoming-invoices/${id}`,
      toast: "incoming_rejected",
    }),
  );
}

export async function deleteIncomingInvoiceAction(
  formData: FormData,
): Promise<void> {
  const { workspaceId, userId } = await requireWorkspace();
  const id = optionalTrim(formData.get("id"));
  if (!id) {
    redirect("/incoming-invoices?invalid=missing_id");
  }
  const result = await deleteIncomingInvoice({
    workspaceId,
    invoiceId: id,
    actorUserId: userId,
  });
  if (!result.ok) {
    redirect(
      `/incoming-invoices/${id}?invalid=${encodeURIComponent(result.error)}`,
    );
  }
  revalidatePath("/incoming-invoices");
  redirect("/incoming-invoices?toast=incoming_deleted");
}
